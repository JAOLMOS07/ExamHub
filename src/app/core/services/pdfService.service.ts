import { Injectable } from "@angular/core";
import { TDocumentDefinitions } from "pdfmake/interfaces";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import JSZip from "jszip";
import saveAs from "file-saver";
pdfMake.vfs = pdfFonts.pdfMake.vfs;
type PDFMake = typeof import("pdfmake/build/pdfmake");

@Injectable({ providedIn: "root" })
export class PDFService {
  private pdfMake: PDFMake = pdfMake;

  open(def: TDocumentDefinitions) {
    this.pdfMake.createPdf(def).open();
  }
  async download(def: TDocumentDefinitions, name: string) {
    this.pdfMake.createPdf(def).download(name);
  }
  async downloadZip(
    pdfDefs: { def: TDocumentDefinitions; name: string }[],
    zipName: string
  ) {
    const zip = new JSZip();
    var cont = 1;

    for (const pdfDef of pdfDefs) {
      const pdfDocGenerator = this.pdfMake.createPdf(pdfDef.def);

      // Generar PDF como Uint8Array
      const pdfData = await new Promise<Uint8Array>((resolve, reject) => {
        pdfDocGenerator.getBuffer((buffer) => {
          resolve(buffer);
        });
      });
      zip.file(`${pdfDef.name}.pdf`, pdfData, { binary: true });
    }

    // Generar ZIP y descargar
    const zipBlob = await zip.generateAsync({ type: "blob" });
    saveAs(zipBlob, `${zipName}.zip`);
  }
}
