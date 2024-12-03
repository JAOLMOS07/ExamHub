import { TestBed } from "@angular/core/testing";
import { TDocumentDefinitions } from "pdfmake/interfaces";
import JSZip from "jszip";
import saveAs from "file-saver";
import { PDFService } from "./pdfService.service";

describe("PDFService", () => {
  let service: PDFService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PDFService],
    });
    service = TestBed.inject(PDFService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });
});
