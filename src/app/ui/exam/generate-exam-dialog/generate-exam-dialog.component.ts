import { Component, Inject, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { Question } from "../../../core/models/question.model";
import { PDFService } from "../../../core/services/pdfService.service";
import { QuestionService } from "../../../core/services/questionService.service";
import { Document, Option } from "../../../core/models/folder.model";
import { objectType } from "../../../core/models/objectType.enum";
import { NgToastService } from "ng-angular-popup";

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
  amountQuestions: number = 1;
  greaterAmount: number = 0;
  constructor(
    private formBuilder: FormBuilder,
    private dialogRef: MatDialogRef<GenerateExamDialogComponent>,
    private pdfService: PDFService,
    private questionService: QuestionService,
    private toast: NgToastService,
    @Inject(MAT_DIALOG_DATA) public data: { exam: Question[] }
  ) {
    this.questionService.getQuestions().subscribe((questions) => {
      this.exam = questions;
    });
  }

  ngOnInit() {
    this.examConfigForm = this.formBuilder.group({
      headerType: ["text", Validators.required],
      institution: [
        "",
        [
          Validators.required,
          Validators.minLength(10),
          Validators.maxLength(40),
        ],
      ],
      title: [
        "",
        [
          Validators.required,
          Validators.minLength(10),
          Validators.maxLength(46),
        ],
      ],
      place: [
        "",
        [
          Validators.required,
          Validators.minLength(10),
          Validators.maxLength(61),
        ],
      ],
      subtitle: [
        "",
        [
          Validators.required,
          Validators.minLength(10),
          Validators.maxLength(65),
        ],
      ],
      date: [new Date()],
      grade: [""],
      amount: [4, Validators.required],
    });

    this.amountQuestions = this.exam.length;
  }

  cancel(): void {
    this.dialogRef.close();
  }

  async generate() {
    if (
      this.examConfigForm.valid ||
      this.examConfigForm.value.headerType === "image"
    ) {
      const config = this.examConfigForm.value;
      await this.generatePDF(config, this.amount).then(() => {
        this.dialogRef.close();
      });
    } else {
      this.toast.danger("Hay campos requeridos", "ExamHub", 3000);
    }
  }
  async preview() {
    if (
      this.examConfigForm.valid ||
      this.examConfigForm.value.headerType === "image"
    ) {
      const config = this.examConfigForm.value;
      await this.generatePDF(config, 1);
    } else {
      this.toast.danger("Hay campos requeridos", "ExamHub", 3000);
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
        image: await this.getBase64ImageFromURL(
          this.logoBase64 ?? "assets/headerexamhub.webp"
        ),
        opacity: 1,
        width: 580,
        alignment: "center",
      };
    } else {
      header = {
        margin: 10,
        columns: [
          {
            image: await this.getBase64ImageFromURL(
              this.logoBase64 ?? "assets/logoexamhub.webp"
            ),
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
    const pdfDefs = [];
    for (let index = 0; index < amount; index++) {
      var examToGenerate: Document[] = this.shuffleExam(this.exam);

      let docDefinition: any = {
        margin: 10,
        pageMargins: [40, 130, 40, 60],
        header: header,
        content: [
          {
            text: `Nombre: _________________________________    Fecha: ${
              config.date ? config.date.toLocaleDateString() : " _________ "
            }   Grado:${
              config.grade !== "" ? config.grade : " ___ "
            }   Examen: ${
              amount > 26 ? index + 1 : this.getAlphabetLetter(index + 1)
            }`,
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
        let name;
        if (config.grade !== "") {
          name = config.grade + "-" + (index + 1);
        } else {
          name = "exam " + "-" + (index + 1);
        }
        pdfDefs.push({ def: docDefinition, name: name });
      } else {
        this.pdfService.open(docDefinition);
      }
    }
    if (amount > 1) {
      let date = new Date();
      this.pdfService.downloadZip(
        pdfDefs,
        date.toLocaleDateString() + "_" + date.toLocaleTimeString() + "_exams"
      );
    }
  }

  shuffleExam(exam: Document[]): Document[] {
    let shuffledExam = exam
      .map((question) => {
        if (question.type === objectType.QUESTION) {
          question.options = this.shuffleArray(question.options!);
        }
        return question;
      })
      .sort(() => Math.random() - 0.5);
    this.exam = shuffledExam;

    if (shuffledExam.length > this.amountQuestions) {
      shuffledExam = shuffledExam.slice(0, this.amountQuestions);
    }

    return shuffledExam;
  }

  shuffleArray<T>(array: T[]): T[] {
    return array.slice().sort(() => Math.random() - 0.5);
  }

  getAlphabetLetter(number: number): string {
    if (number < 1 || number > 26) {
      throw new Error("El número debe estar entre 1 y 26.");
    }

    return String.fromCharCode(65 + number - 1);
  }
}
