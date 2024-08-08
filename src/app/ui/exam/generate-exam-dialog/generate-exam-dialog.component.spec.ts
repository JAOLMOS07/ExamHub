import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenerateExamDialogComponent } from './generate-exam-dialog.component';

describe('GenerateExamDialogComponent', () => {
  let component: GenerateExamDialogComponent;
  let fixture: ComponentFixture<GenerateExamDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenerateExamDialogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(GenerateExamDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
