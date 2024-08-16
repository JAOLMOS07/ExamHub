import { Injectable } from "@angular/core";
import { TDocumentDefinitions } from "pdfmake/interfaces";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
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
}
