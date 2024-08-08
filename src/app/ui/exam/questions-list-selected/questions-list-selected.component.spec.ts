import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuestionsListSelectedComponent } from './questions-list-selected.component';

describe('QuestionsListSelectedComponent', () => {
  let component: QuestionsListSelectedComponent;
  let fixture: ComponentFixture<QuestionsListSelectedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuestionsListSelectedComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(QuestionsListSelectedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
