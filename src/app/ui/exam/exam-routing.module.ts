import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { PRINCIPAL } from "../routes.constants";
import { ExamComponent } from "./exam.component";

const routes: Routes = [
  {
    path: "",
    component: ExamComponent,
    pathMatch: "prefix",
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ExamsRoutingModule {}
