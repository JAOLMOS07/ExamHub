import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { PrincipalComponent } from "./principal.component";
import { EXAM, GRADE, PRINCIPAL } from "../routes.constants";
import {
  canActivate,
  redirectLoggedInTo,
  redirectUnauthorizedTo,
} from "@angular/fire/auth-guard";
const routes: Routes = [
  {
    path: "",
    component: PrincipalComponent,
    children: [
      {
        path: PRINCIPAL.HOME,
        loadComponent: () =>
          import("./home/home.component").then((m) => m.HomeComponent),
        ...canActivate(() => redirectUnauthorizedTo(["/login"])),
      },
      {
        path: PRINCIPAL.LOGIN,

        loadComponent: () =>
          import("../login/login.component").then((m) => m.LoginComponent),
        ...canActivate(() => redirectLoggedInTo(["/home"])),
      },
      {
        path: EXAM.NAME,
        loadChildren: () =>
          import("../exam/exam.module").then((m) => m.ExamModule),
      },
      {
        path: "preferences",
        loadComponent: () =>
          import("../preferences/preferences.component").then(
            (m) => m.PreferencesComponent
          ),
        ...canActivate(() => redirectUnauthorizedTo(["/login"])),
      },
      // Feature de calificación: lista, scanner y pantalla de grading.
      {
        path: GRADE.NAME,
        ...canActivate(() => redirectUnauthorizedTo(["/login"])),
        children: [
          {
            path: "",
            loadComponent: () =>
              import("../grade/grade-list.component").then(
                (m) => m.GradeListComponent
              ),
          },
          {
            path: GRADE.SCAN,
            loadComponent: () =>
              import("../grade/scan/scan.component").then(
                (m) => m.ScanComponent
              ),
          },
          {
            path: `${GRADE.EXAM}/:examId`,
            loadComponent: () =>
              import("../grade/exam-detail/exam-detail.component").then(
                (m) => m.ExamDetailComponent
              ),
          },
          {
            path: `${GRADE.EXAM}/:examId/${GRADE.GRADE_NEW}`,
            loadComponent: () =>
              import("../grade/grading/grading.component").then(
                (m) => m.GradingComponent
              ),
          },
        ],
      },
      {
        path: "",
        redirectTo: `${PRINCIPAL.HOME}`,
        pathMatch: "prefix",
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PrincipalRoutingModule {}
