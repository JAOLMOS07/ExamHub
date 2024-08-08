import { bootstrapApplication } from "@angular/platform-browser";
import { appConfig } from "./app/ui/app.config";
import { AppComponent } from "./app/ui/app.component";

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err)
);
