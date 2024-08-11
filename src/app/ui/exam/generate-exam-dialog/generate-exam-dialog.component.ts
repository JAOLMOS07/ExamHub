import { Component, Inject, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { Question } from "../../../core/models/question.model";
import { PDFService } from "../../../core/services/pdfService.service";
import { QuestionService } from "../../../core/services/questionService.service";
import { Document, Option } from "../../../core/models/folder.model";
import { text } from "stream/consumers";
import { objectType } from "../../../core/models/objectType.enum";

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
  greaterAmount: number = 0;
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
      var examToGenerate: Document[] = this.shuffleExam(this.exam);

      let docDefinition: any = {
        margin: 10,
        pageMargins: [40, 130, 40, 60],
        header: header,
        content: [
          {
            text: `Nombre: __________________________________________    Fecha: ${config.date.toLocaleDateString()}   Grado:${
              config.grade
            }   Examen: ${this.getAlphabetLetter(index + 1)}`,
            style: "subtitle",
            alignment: "center",
            margin: [0, 0, 0, 10],
          },
          {
            ol: examToGenerate.map((question) => {
              if (question.options!.length > this.greaterAmount) {
                this.greaterAmount = question.options!.length;
              }
              return [
                {
                  text: question.name,
                  style: "questionHeader",
                  margin: [0, 10, 0, 0],
                },
                {
                  type: "upper-alpha",
                  ol: question.options!.map((option, i) => {
                    return {
                      text: ` - ${option.content}`,
                    };
                  }),
                },
              ];
            }),
          },
          { text: "", pageBreak: "before" },
          {
            text: `Hoja de respuestas examen: ${this.getAlphabetLetter(
              index + 1
            )}`,
            alignment: "center",
            margin: [0, 0, 0, 10],
          },
          {
            stack: await Promise.all(
              examToGenerate.map(async (question, $index): Promise<any> => {
                return [
                  {
                    columns: [
                      {
                        text:
                          examToGenerate.length > 9
                            ? $index > 8
                              ? `${$index + 1}.`
                              : `0${$index + 1}.`
                            : `${$index + 1}.`,
                        width: "auto",
                        margin: [10, 5, 10, 5],
                      },
                      {
                        width: "auto",
                        stack: [
                          {
                            columns: await Promise.all(
                              Array(this.greaterAmount)
                                .fill(null)
                                .map(async (item, $index): Promise<any> => {
                                  return [
                                    {
                                      image: await this.getBase64ImageFromURL(
                                        `assets/op${this.getAlphabetLetter(
                                          $index + 1
                                        )}.png`
                                      ),
                                      width: 15,
                                      margin: [10, 0, 10, 0],
                                    },
                                  ];
                                })
                            ),
                            margin: [10, 5, 10, 5],
                          },
                        ],
                      },
                    ],
                  },
                ];
              })
            ),
            margin: [10, 0, 0, 0],
            alignment: "center",
          },
          { text: "", pageBreak: "before" },
          {
            text: `Hoja de respuestas del maestro examen: ${this.getAlphabetLetter(
              index + 1
            )}`,
            alignment: "center",
            margin: [0, 0, 0, 10],
          },
          {
            stack: await Promise.all(
              examToGenerate.map(async (question, $index): Promise<any> => {
                return [
                  {
                    columns: [
                      {
                        text:
                          examToGenerate.length > 9
                            ? $index > 9
                              ? `${$index + 1}.`
                              : `0${$index + 1}.`
                            : `${$index + 1}.`,
                        width: "auto",
                        margin: [10, 5, 10, 5],
                      },
                      {
                        width: "auto",
                        stack: [
                          {
                            columns: await Promise.all(
                              question.options!.map(
                                async (item, $index): Promise<any> => {
                                  if (item.correct) {
                                    return [
                                      {
                                        image: await this.getBase64ImageFromURL(
                                          "assets/relleno.png"
                                        ),
                                        width: 15,
                                        margin: [10, 0, 10, 0],
                                      },
                                    ];
                                  } else {
                                    return [
                                      {
                                        image: await this.getBase64ImageFromURL(
                                          `assets/op${this.getAlphabetLetter(
                                            $index + 1
                                          )}.png`
                                        ),
                                        width: 15,
                                        margin: [10, 0, 10, 0],
                                      },
                                    ];
                                  }
                                }
                              )
                            ),
                            margin: [10, 5, 10, 5],
                          },
                        ],
                      },
                    ],
                  },
                ];
              })
            ),
            margin: [10, 0, 0, 0],
            alignment: "center",
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
        console.log(docDefinition);

        this.pdfService.open(docDefinition);
      }
    }
  }

  shuffleExam(exam: Document[]): Document[] {
    return exam
      .map((question) => {
        if (question.type === objectType.question) {
          // Shuffle the options of the question
          question.options = this.shuffleArray(question.options!);
        }
        return question;
      })
      .sort(() => Math.random() - 0.5); // Shuffle the questions
  }

  shuffleArray<T>(array: T[]): T[] {
    return array
      .slice() // Create a copy of the original array
      .sort(() => Math.random() - 0.5); // Randomly sort the array
  }

  getAlphabetLetter(number: number): string {
    if (number < 1 || number > 26) {
      throw new Error("El número debe estar entre 1 y 26.");
    }

    return String.fromCharCode(65 + number - 1); // 65 es el código ASCII de 'A'
  }
}
