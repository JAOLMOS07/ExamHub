import { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "",
    loadChildren: () =>
      import("./principal/principal.module").then((m) => m.PrincipalModule),
  },
];
