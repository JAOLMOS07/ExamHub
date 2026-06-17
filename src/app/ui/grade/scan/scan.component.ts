import { CommonModule } from "@angular/common";
import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
} from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import jsQR from "jsqr";
import { ToastService } from "../../../core/services/toast.service";
import { decodeQrPayload, QrPayload } from "../../../core/utils/qrPayload.util";
import { MODULES } from "../../routes.constants";
import { SharedModule } from "../../shared/shared.module";

/**
 * Pantalla del scanner de QR.
 *
 * Flujo:
 *   1. Pide permiso de cámara (preferentemente la trasera).
 *   2. Cada ~150ms toma un frame del video, lo dibuja en un canvas
 *      oculto y se lo pasa a jsQR.
 *   3. Si jsQR devuelve un QR cuyo payload es de ExamHub válido,
 *      redirige a /grade/exam/:examId?versionId=...
 *   4. Fallback: el usuario puede subir una foto desde input file.
 *
 * Decisión: no llamamos a Firestore acá. Solo decodificamos el QR.
 * El componente de grading hace el lookup del examen — así esta
 * pantalla queda cacheable y rápida.
 */
@Component({
  selector: "app-scan",
  standalone: true,
  imports: [CommonModule, RouterModule, SharedModule],
  templateUrl: "./scan.component.html",
})
export class ScanComponent implements OnDestroy {
  @ViewChild("videoEl") videoEl?: ElementRef<HTMLVideoElement>;
  @ViewChild("canvasEl") canvasEl?: ElementRef<HTMLCanvasElement>;

  /** Mensaje de estado mostrado al usuario. */
  status: "idle" | "starting" | "scanning" | "error" = "idle";
  errorMessage = "";

  private stream: MediaStream | null = null;
  private rafId: number | null = null;
  private lastScanAt = 0;
  /** Throttle: cada cuántos ms intentamos decodificar. */
  private readonly SCAN_INTERVAL_MS = 150;

  constructor(
    private router: Router,
    private toast: ToastService,
    private zone: NgZone
  ) {}

  ngOnDestroy(): void {
    this.stopScanning();
  }

  async startCamera(): Promise<void> {
    if (this.status === "scanning" || this.status === "starting") return;
    this.status = "starting";
    this.errorMessage = "";

    try {
      // facingMode 'environment' = cámara trasera. Si no hay (web en
      // desktop) cae a la frontal.
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      const video = this.videoEl?.nativeElement;
      if (!video) throw new Error("Video element no disponible");
      video.srcObject = this.stream;
      await video.play();
      this.status = "scanning";
      this.scheduleNextFrame();
    } catch (err: any) {
      console.error("Error iniciando cámara:", err);
      this.status = "error";
      if (err?.name === "NotAllowedError") {
        this.errorMessage =
          "Necesitamos permiso para usar la cámara. Habilitalo en la configuración del navegador.";
      } else if (err?.name === "NotFoundError") {
        this.errorMessage =
          "No encontramos una cámara en este dispositivo. Probá subiendo una foto.";
      } else {
        this.errorMessage =
          "No pudimos iniciar la cámara. Probá subiendo una foto del examen.";
      }
    }
  }

  stopScanning(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.status !== "error") {
      this.status = "idle";
    }
  }

  /**
   * Bucle por animation frame. Throttled a SCAN_INTERVAL_MS para no
   * gastar batería decodificando 60 veces por segundo cuando 6 alcanza.
   */
  private scheduleNextFrame(): void {
    // Salimos del Zone de Angular para no disparar change detection
    // por cada frame. Solo entramos cuando hay un match.
    this.zone.runOutsideAngular(() => {
      const loop = (ts: number) => {
        if (this.status !== "scanning") return;
        if (ts - this.lastScanAt >= this.SCAN_INTERVAL_MS) {
          this.lastScanAt = ts;
          this.tryDecodeFrame();
        }
        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    });
  }

  private tryDecodeFrame(): void {
    const video = this.videoEl?.nativeElement;
    const canvas = this.canvasEl?.nativeElement;
    if (!video || !canvas) return;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const result = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });
    if (!result) return;

    const payload = decodeQrPayload(result.data);
    if (!payload) return; // QR detectado pero no es de ExamHub

    // Re-entramos al Zone para que router + toast se vean reflejados.
    this.zone.run(() => this.onPayloadDetected(payload));
  }

  /**
   * Procesa una foto subida desde el input file. Útil para profes que
   * ya tienen las hojas escaneadas o no tienen cámara.
   */
  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const img = await this.loadImage(file);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas no disponible");
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(imageData.data, imageData.width, imageData.height);
      if (!result) {
        this.toast.warning(
          "No detectamos un QR en la foto. Probá con una imagen más nítida.",
          "ExamHub",
          3500
        );
        return;
      }
      const payload = decodeQrPayload(result.data);
      if (!payload) {
        this.toast.warning(
          "El QR no parece ser de ExamHub.",
          "ExamHub",
          3500
        );
        return;
      }
      this.onPayloadDetected(payload);
    } catch (err) {
      console.error("Error procesando archivo:", err);
      this.toast.danger(
        "No pudimos leer esa imagen.",
        "ExamHub",
        3500
      );
    }
  }

  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private onPayloadDetected(payload: QrPayload): void {
    this.stopScanning();
    this.toast.success("QR detectado.", "ExamHub", 1500);
    // Vamos directo a la pantalla de calificar (no al detalle).
    this.router.navigate([MODULES.GRADE.EXAM_GRADE(payload.examId)], {
      queryParams: { versionId: payload.versionId },
    });
  }
}
