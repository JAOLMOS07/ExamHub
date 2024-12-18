import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { PrincipalComponent } from "./principal.component";
import { EXAM, PRINCIPAL } from "../routes.constants";
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
