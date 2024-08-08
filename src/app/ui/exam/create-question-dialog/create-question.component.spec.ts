import { ComponentFixture, TestBed } from "@angular/core/testing";

import { CreateQuestionDialogComponent } from "./create-question.component";

describe("CreateQuestionComponent", () => {
  let component: CreateQuestionDialogComponent;
  let fixture: ComponentFixture<CreateQuestionDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateQuestionDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateQuestionDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
