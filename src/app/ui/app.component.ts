import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { PrincipalModule } from "./principal/principal.module";
import { NgToastModule, ToasterPosition } from "ng-angular-popup";
@Component({
  selector: "app-root",
  standalone: true,
  imports: [PrincipalModule, RouterOutlet, NgToastModule],
  providers: [],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent {
  title = "examhub";
  ToasterPosition = ToasterPosition;
}
