import { Injectable } from "@angular/core";
import { TDocumentDefinitions } from "pdfmake/interfaces";

type PDFMake = typeof import("pdfmake/build/pdfmake");

@Injectable({ providedIn: "root" })
export class PDFService {
  private pdfMake!: PDFMake;
  private fonts!: { [file: string]: string };

  async loadPDFMaker() {
    if (!this.pdfMake) {
      this.pdfMake = await import("pdfmake/build/pdfmake");
      (window as any).pdfMake.vfs = (
        await import("pdfmake/build/vfs_fonts")
      ).pdfMake.vfs;
    }
  }

  async open(def: TDocumentDefinitions) {
    if (!this.pdfMake) {
      try {
        await this.loadPDFMaker();
      } catch (error) {
        console.error("Failed to load pdf maker lib");
      }
    }
    this.pdfMake.createPdf(def).open();
  }
  async download(def: TDocumentDefinitions, name: string) {
    if (!this.pdfMake) {
      try {
        await this.loadPDFMaker();
      } catch (error) {
        console.error("Failed to load pdf maker lib");
      }
    }

    this.pdfMake.createPdf(def).download(name);
  }
}
