import { SharedModule } from "./../shared/shared.module";
import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { PrincipalComponent } from "./principal.component";
import { RouterOutlet } from "@angular/router";
import { PrincipalRoutingModule } from "./principal-routing.module";
import { HomeComponent } from "./home/home.component";
import { FormsModule } from "@angular/forms";
import { PDFService } from "../../core/services/pdfService.service";
import { CreateFolderComponent } from "./home/components/create-folder/create-folder.component";
import { CreateQuestionDialogComponent } from "../exam/create-question-dialog/create-question.component";
import { QuestionListComponent } from "./home/components/question-list/question-list.component";
import { ItemListSelectedComponent } from "./home/components/item-list-selected/item-list-selected.component";
import { UserService } from "../../core/services/UserService.service";
import { ItemQuestionComponent } from "./home/components/item-question/item-question.component";
@NgModule({
  declarations: [
    PrincipalComponent,
    CreateFolderComponent,
    CreateQuestionDialogComponent,
    QuestionListComponent,
    ItemListSelectedComponent,
    ItemQuestionComponent,
  ],
  imports: [
    CommonModule,
    RouterOutlet,
    PrincipalRoutingModule,
    FormsModule,
    SharedModule,
    RouterOutlet,
  ],
  providers: [PDFService, UserService],
  exports: [PrincipalComponent, QuestionListComponent, ItemQuestionComponent],
})
export class PrincipalModule {}
