import { Injectable } from "@angular/core";
import { Auth } from "@angular/fire/auth";
import {
  Storage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "@angular/fire/storage";

/**
 * Resultado de una subida exitosa.
 */
export interface UploadedImage {
  /** URL pública firmada (válida con auth) para mostrar en <img src>. */
  url: string;
  /** Path interno en Storage. Necesario para borrar después. */
  path: string;
}

/**
 * Gestiona la subida y borrado de imágenes a Firebase Storage.
 *
 * Estructura de paths:
 *   users/<uid>/questions/<questionId>/<timestamp>_<filename>
 *
 * Validaciones:
 *   - Tipo: solo image/* (png, jpg, webp, gif).
 *   - Tamaño: máximo 4 MB por imagen.
 */
@Injectable({ providedIn: "root" })
export class ImageUploadService {
  /** Tipos MIME aceptados. */
  private readonly ALLOWED_TYPES = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
  ];

  /** 4 MB en bytes. */
  private readonly MAX_SIZE_BYTES = 4 * 1024 * 1024;

  constructor(private storage: Storage, private auth: Auth) {}

  /**
   * Valida un File contra las restricciones del servicio.
   * Devuelve null si OK, o un string con el mensaje de error.
   */
  validate(file: File): string | null {
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      return "Formato no soportado. Usá PNG, JPG, WEBP o GIF.";
    }
    if (file.size > this.MAX_SIZE_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      return `La imagen pesa ${mb} MB. El máximo permitido es 4 MB.`;
    }
    return null;
  }

  /**
   * Sube una imagen para una pregunta específica y retorna URL + path.
   */
  async uploadForQuestion(
    file: File,
    questionId: string
  ): Promise<UploadedImage> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) {
      throw new Error(
        "No hay sesión activa. Iniciá sesión para subir imágenes."
      );
    }

    const validation = this.validate(file);
    if (validation) {
      throw new Error(validation);
    }

    // Path único: timestamp + nombre saneado para evitar choques si
    // se sube otra imagen con el mismo nombre.
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `users/${uid}/questions/${questionId}/${Date.now()}_${safeName}`;

    const storageRef = ref(this.storage, path);
    await uploadBytes(storageRef, file, {
      contentType: file.type,
      cacheControl: "public,max-age=31536000",
    });
    const url = await getDownloadURL(storageRef);
    return { url, path };
  }

  /**
   * Borra una imagen previamente subida. Silencia errores de
   * "not found" para que sea idempotente.
   */
  async delete(path: string): Promise<void> {
    if (!path) return;
    try {
      const storageRef = ref(this.storage, path);
      await deleteObject(storageRef);
    } catch (e: any) {
      // object-not-found: la imagen ya no está, está OK.
      if (e?.code !== "storage/object-not-found") {
        console.warn("No se pudo borrar la imagen:", path, e);
      }
    }
  }
}
