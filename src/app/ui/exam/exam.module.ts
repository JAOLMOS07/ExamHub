import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { SharedModule } from "../shared/shared.module";
import { ExamComponent } from "./exam.component";
import { ExamsRoutingModule } from "./exam-routing.module";
import { PDFService } from "../../core/services/pdfService.service";
import { GenerateExamDialogComponent } from "./generate-exam-dialog/generate-exam-dialog.component";
import { CreateQuestionComponent } from "./create-question/create-question.component";
import { QuestionsListSelectedComponent } from "./questions-list-selected/questions-list-selected.component";

@NgModule({
  declarations: [
    ExamComponent,
    GenerateExamDialogComponent,
    CreateQuestionComponent,
    QuestionsListSelectedComponent,
  ],
  imports: [
    CommonModule,
    RouterModule,
    ExamsRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
  ],
  providers: [PDFService, ReactiveFormsModule, FormsModule],
})
export class ExamModule {}
