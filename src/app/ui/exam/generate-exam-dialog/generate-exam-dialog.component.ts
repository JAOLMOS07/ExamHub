import { Component, Inject, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { Question } from "../../../core/models/question.model";
import { PDFService } from "../../../core/services/pdfService.service";
import { QuestionService } from "../../../core/services/questionService.service";
import { Document, Option } from "../../../core/models/folder.model";

@Component({
  selector: "app-generate-exam-dialog",
  templateUrl: "./generate-exam-dialog.component.html",
  styleUrls: ["./generate-exam-dialog.component.css"],
})
export class GenerateExamDialogComponent implements OnInit {
  examConfigForm!: FormGroup;
  logoBase64: string | ArrayBuffer | null = null;
  exam: Document[] = [];
  amount: number = 1;
  constructor(
    private formBuilder: FormBuilder,
    private dialogRef: MatDialogRef<GenerateExamDialogComponent>,
    private pdfService: PDFService,
    private questionService: QuestionService,
    @Inject(MAT_DIALOG_DATA) public data: { exam: Question[] }
  ) {
    this.questionService.getQuestions().subscribe((questions) => {
      this.exam = questions;
    });
  }

  ngOnInit() {
    this.examConfigForm = this.formBuilder.group({
      headerType: ["text", Validators.required],
      institution: ["UNIVERSIDAD POPULAR DEL CESAR", Validators.required],
      title: ["EXAMEN DE CIENCIAS", Validators.required],
      place: ["Valledupar Cesar - 100004", Validators.required],
      subtitle: ["Profesor: Jhoger Andrés Olmos", Validators.required],
      date: [new Date(), Validators.required],
      grade: ["10A", Validators.required],
      amount: [4, Validators.required],
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  async generate() {
    if (this.examConfigForm.valid) {
      const config = this.examConfigForm.value;
      await this.generatePDF(config, this.amount);
      this.dialogRef.close();
    }
  }
  async preview() {
    if (this.examConfigForm.valid) {
      const config = this.examConfigForm.value;
      await this.generatePDF(config, 1);
    }
  }
  getBase64ImageFromURL(url: any) {
    return new Promise((resolve, reject) => {
      var img = new Image();
      img.setAttribute("crossOrigin", "anonymous");

      img.onload = () => {
        var canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;

        var ctx = canvas.getContext("2d");
        ctx!.drawImage(img, 0, 0);

        var dataURL = canvas.toDataURL("image/png");

        resolve(dataURL);
      };

      img.onerror = (error) => {
        reject(error);
      };

      img.src = url;
    });
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        this.logoBase64 = reader.result;
      };
      reader.readAsDataURL(input.files[0]);
    }
  }

  async generatePDF(config: any, amount: number) {
    let header;

    if (config.headerType === "image") {
      header = {
        image: await this.getBase64ImageFromURL(this.logoBase64),
        opacity: 1,
        width: 580,
        alignment: "center",
      };
    } else {
      header = {
        margin: 10,
        columns: [
          {
            image: await this.getBase64ImageFromURL(this.logoBase64),
            opacity: 0.5,
            width: 80,
          },
          [
            {
              text: config.institution,
              alignment: "center",
              fontSize: 18,
              bold: true,
            },
            {
              text: config.title,
              alignment: "center",
              fontSize: 16,
              bold: true,
            },
            {
              text: config.place,
              alignment: "center",
              fontSize: 12,
              bold: false,
            },
            {
              text: config.subtitle,
              style: "subtitle",
              alignment: "center",
              fontSize: 11,
              bold: false,
            },
          ],
        ],
      };
    }

    for (let index = 0; index < amount; index++) {
      var examToGenerate: Document[] = shuffleArray(this.exam);
      let docDefinition: any = {
        margin: 10,
        pageMargins: [40, 130, 40, 60],
        header: header,

        content: [
          {
            text: `Nombre: __________________________________________    Fecha: ${config.date.toLocaleDateString()}   Grado:${
              config.grade
            }`,
            style: "subtitle",
            alignment: "center",
            margin: [0, 0, 0, 10],
          },
          {
            ol: examToGenerate.map((question) => {
              var options: Option[] = shuffleArray(question.options);
              return [
                {
                  text: question.name,
                  style: "questionHeader",
                  margin: [0, 10, 0, 0],
                },
                {
                  type: "upper-alpha",
                  ol: options?.map((option, i) => {
                    return {
                      text: ` - ${option.content}`,
                    };
                  }),
                },
              ];
            }),
          },
        ],

        styles: {
          questionHeader: {
            fontSize: 12,
            bold: true,
          },
          questionAnswer: {
            margin: [5, 2, 10, 20],
          },
        },
      };
      if (amount > 1) {
        this.pdfService.download(
          docDefinition,
          config.date.toLocaleDateString() + config.grade
        );
        this.exam = examToGenerate;
      } else {
        this.pdfService.open(docDefinition);
      }
    }
  }
}

function shuffleArray<T>(array?: T[]): T[] {
  if (!array) return [];
  return array
    .slice() // Crear una copia del array original
    .sort(() => Math.random() - 0.5); // Ordenar aleatoriamente
}
