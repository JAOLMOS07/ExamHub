/**
 * Guardar un archivo generado (PDF, Excel, ZIP).
 *
 * En el celular abre el menú "Compartir" del sistema (WhatsApp, Drive,
 * correo…), que es lo que el docente suele hacer con un boletín. En el
 * computador, o si el navegador no permite compartir archivos, se
 * descarga como siempre. Es el único punto a cambiar cuando la app se
 * empaquete con Capacitor (Filesystem + Share).
 */
export async function saveFile(blob: Blob, fileName: string): Promise<"shared" | "downloaded"> {
  const name = fileName.replace(/[/\\?%*:|"<>]/g, "-");
  const nav = navigator as Navigator & { canShare?: (d: any) => boolean };
  const touch = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  if (touch && typeof File !== "undefined" && nav.canShare) {
    const file = new File([blob], name, { type: blob.type || "application/octet-stream" });
    if (nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: name });
        return "shared";
      } catch (err: any) {
        // Canceló el menú: no descargar además.
        if (err?.name === "AbortError") return "shared";
        // NotAllowedError (se venció el gesto del usuario) → descarga.
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded";
}

/** PDF de pdfmake → Blob. */
export function pdfToBlob(pdf: { getBlob: (cb: (b: Blob) => void) => void }): Promise<Blob> {
  return new Promise((resolve) => pdf.getBlob(resolve));
}
