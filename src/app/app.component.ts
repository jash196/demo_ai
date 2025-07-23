import { Component } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false,
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'AI Angular Project';
  getSessionId: any
  deviceForm: FormGroup;
  responseSteps: string[] = [];
  allComponents: any;
  recommendedComponents: any;
  intendedUsers: any;
  gsprNumber: number | null = null;
  selectedComponents: any;
  selectedComponent: string | undefined;
  alertMessage: string | null = null;
  alertType: string = ''; // 'success', 'error', 'info'
  checkedIndexes: number[] = [];
  justifications: { [key: string]: string[] } = {};
  headers = new HttpHeaders({
    'Content-Type': 'application/json',
    // 'Authorization': 'Bearer sk-17232931',
  });
  justificationsResponse: any;
  justifiedComponentNames: any;
  generatedGsprItem: any;

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.deviceForm = this.fb.group({
      deviceType: ['', [Validators.required, Validators.minLength(3)]],
      // components: ['', [Validators.required, Validators.minLength(3)]],
      intendedPurpose: ['', [Validators.required, Validators.minLength(5)]],
      // intendedUsers: ['', [Validators.required, Validators.minLength(3)]],
      riskClassification: [''],
      riskLevel: [''],
      riskRegion: ['']
    });
  }



  ngOnInit(): void {
    this.getSessionId = sessionStorage.getItem('sessionId') || '';

    if (this.getSessionId) {
      this.http.get<any>(`http://narmada.merai.cloud:8585/filter/${this.getSessionId}`)
        .subscribe({
          next: (filterData) => {
            if (Array.isArray(filterData)) {
              this.selectedComponents = filterData
                .filter((comp: any) => comp.component_name)
                .map((comp: any) => comp.component_name);

              console.log('Selected Components:', this.selectedComponents);

            } else {
              this.selectedComponents = [];
            }
          },
          error: (err) => {
            alert('Filter API Error (GET): ' + (err.error?.message || err.message));
          }
        });
    }
  }

  isInvalid(field: string): boolean {
    const control = this.deviceForm.get(field);
    return control?.touched && control?.invalid || false;
  }

  onSubmit(): void {
    if (this.deviceForm.invalid) return;

    const formValue = this.deviceForm.value;
    const payload = {
      device_type: formValue.deviceType,
      intended_purpose: formValue.intendedPurpose,
    };


    this.http.post<any>('http://narmada.merai.cloud:8585/user-input/', payload, { headers: this.headers })
      .subscribe({
        next: (result) => {
          // Get session id from result
          const content = result?.choices?.[0]?.message?.content || '';
          this.responseSteps = content.split(/\n(?=\d+\.)/).map((s: any) => s.replace(/^\d+\.\s*/, '').trim());
          this.getSessionId = (result?.session_id || result?.sessionId || null);
          console.log('Session ID:', this.getSessionId);
          this.recommendedcomponentsGet()
          // Fetch risk classification based on session ID (not from form, but generated)
          if (this.getSessionId) {
            this.http.get<any>(`http://narmada.merai.cloud:8585/risk-classification/${this.getSessionId}`)
              .subscribe({
                next: (riskData) => {
                  // Update riskClassification field with generated data
                  const riskClassification = riskData?.risk_classification || {};
                  // Format risk classification for display
                  const formattedRisk = Object.entries(riskClassification)
                    .map(([region, classification]) => `${region}: ${classification}`)
                    .join(', ');
                  this.deviceForm.get('riskClassification')?.setValue(formattedRisk);

                  // Optionally, set individual fields if present
                  this.deviceForm.get('riskLevel')?.setValue(riskClassification['EU MDR'] || '');
                  this.deviceForm.get('riskRegion')?.setValue('EU MDR');
                },
                error: (err) => {
                  alert('Risk Classification API Error: ' + (err.error?.message || err.message));
                }
              });
          }
          // Fetch intended users based on session ID
          if (this.getSessionId) {
            this.http.get<any>(`http://narmada.merai.cloud:8585/intended-user/${this.getSessionId}`)
              .subscribe({
                next: (userData) => {
                  this.intendedUsers = Array.isArray(userData?.intended_users) ? userData.intended_users : [];
                },
                error: (err) => {
                  alert('Intended User API Error: ' + (err.error?.message || err.message));
                }
              });
          }
        },
        error: (err) => {
          alert('API Error: ' + (err.error?.message || err.message));
        }
      });
  }

  recommendedcomponentsGet() {
    if (this.getSessionId) {
      this.http.get<any>(`http://narmada.merai.cloud:8585/recommender/${this.getSessionId}`)
        .subscribe({
          next: (data) => {
            console.log('hello', data);
            // Handle GET response as needed
            if (data?.steps && Array.isArray(data.steps)) {
              this.responseSteps = data.steps.map((step: any) => typeof step === 'string' ? step.trim() : String(step));
            } else if (typeof data === 'string') {
              this.responseSteps = data.split(/\n(?=\d+\.)/).map((s: any) => s.replace(/^\d+\.\s*/, '').trim());
            } else {
              this.responseSteps = [];
            }
            // Store all_components and recommended_components in separate properties
            this.allComponents = Array.isArray(data?.all_components) ? data.all_components : [];
            this.recommendedComponents = Array.isArray(data?.recommended_components) ? data.recommended_components : [];
            // Optionally, add them to responseSteps as lists if present
            if (this.allComponents.length > 0) {
              this.responseSteps.push('All Components:');
              this.allComponents.forEach((comp: string) => {
                this.responseSteps.push('- ' + comp);
              });
            }
            if (this.recommendedComponents.length > 0) {
              this.responseSteps.push('Recommended Components:');
              this.recommendedComponents.forEach((comp: string) => {
                this.responseSteps.push('- ' + comp);
              });
            }
          },
          error: (err) => {
            alert('Recommender API Error: ' + (err.error?.message || err.message));
          }
        });
    }
  }


  onCheckboxChange(event: any, index: number): void {
    if (event.target.checked) {
      if (!this.checkedIndexes.includes(index)) {
        this.checkedIndexes.push(index);
      }
    } else {
      this.checkedIndexes = this.checkedIndexes.filter(i => i !== index);
    }
    // You can use this.checkedIndexes wherever you need the list of checked indexes
    console.log('Checked indexes:', this.checkedIndexes);
  }

  isSelected(component: string): boolean {
    const isSelected = Array.isArray(this.selectedComponents) && this.selectedComponents.includes(component);
    // console.log(`Component ${component} is selected: ${isSelected}`);
    return isSelected;
  }

  updateComponentsFromCheckedIndexes(components: string[]): void {
    if (!this.getSessionId) return;
    // Determine which components to add or remove based on checkedIndexes
    const additionalComponents = this.checkedIndexes.map(i => components[i]);
    const removeComponents = components.filter((_, i) => !this.recommendedComponents.includes(components[i]));
    const payload = {
      additional_components: additionalComponents,
      remove_components: removeComponents
    };
    this.http.post<any>(
      `http://narmada.merai.cloud:8585/recommender/${this.getSessionId}`,
      payload,
      { headers: this.headers }
    ).subscribe({
      next: (res) => {
        this.recommendedComponents = Array.isArray(res?.recommended_components) ? res.recommended_components : [];
        this.allComponents = Array.isArray(res?.all_components) ? res.all_components : [];

        // Pass only the first index of checkedIndexes and store the component value in one variable
        if (this.checkedIndexes.length > 0) {
          const firstIndex = this.checkedIndexes[0];
          this.selectedComponent = components[firstIndex];
          console.log('Selected component (first checked):', this.selectedComponent);
        }
      },
      error: (err) => {
        alert('Recommender API Error (POST): ' + (err.error?.message || err.message));
      }
    });
  }

  fetchJustifications(): void {
    if (!this.selectedComponent) {
      this.showAlert('Please select a component first & submit the selected component before fetching justifications.', 'error');
      return;
    }

    if (this.selectedComponent) {
      // If the selected component changes, clear previous justifications
      this.justifications = {};
    }

    const url = `http://narmada.merai.cloud:8585/filter/${this.getSessionId}`;
    const body = {
      component_name: this.selectedComponent
    };

    this.http.post<{ justifications: Record<string, string[]> }>(url, body).subscribe({
      next: (response) => {
        this.justifications = response.justifications;
        console.log('Justifications:', this.justifications);
      },
      error: (error) => {
        console.error('Failed to fetch justifications:', error);
      }
    });
  }

  generateGSPR(gsprValue: string): void {
    if (!gsprValue) {
      alert('Please enter a GSPR Number.');
      return;
    }

    const payload = {
      component_name: this.selectedComponent,
      gspr_number: gsprValue.toString(),
    };

    const url = `http://narmada.merai.cloud:8585/gspr-generator/${this.getSessionId}`;

    this.http.post<any>(url, payload).subscribe({
      next: (res) => {
        const gsprItem = res?.gspr_item;

        if (gsprItem) {
          console.log('✅ GSPR generated successfully!');
          console.log('Component:', gsprItem.component);
          console.log('GSPR Number:', gsprItem.gspr);
          console.log('Design Input:', gsprItem.design_input);
          console.log('Applicability:', gsprItem.applicability);
          console.log('Justification:', gsprItem.justification);
          console.log('Requirements:', gsprItem.requirements);
          console.log('Standards:', gsprItem.standards?.join(', '));

          // Optionally: assign it to a variable for UI rendering
          this.generatedGsprItem = gsprItem;

          alert('GSPR generation successful!');
        } else {
          console.warn('⚠️ Response received but no gspr_item found.');
          alert('GSPR generation succeeded, but no data found.');
        }
      },
      error: (err) => {
        console.error('❌ Error generating GSPR:', err);
        alert('GSPR generation failed.');
      },
    });
  }

  showAlert(message: string, type: 'success' | 'error' | 'info'): void {
    this.alertMessage = message;
    this.alertType = type;

    setTimeout(() => {
      this.alertMessage = null;
    }, 5000);
  }

  resetArrays(): void {
    this.recommendedcomponentsGet();
    this.selectedComponents = [];
    this.checkedIndexes = [];
    this.recommendedComponents = [];
    this.allComponents = [];

  }

  resetForm(): void {
    const confirmed = confirm('Are you sure you want to reset the form and go back to home?');

    if (confirmed) {
      this.deviceForm.reset();
      this.responseSteps = [];

      // Optional: Navigate to home if using Angular Router
      // this.router.navigate(['/']); 
    } else {
      // Do nothing if user cancels
      console.log('Reset cancelled by user.');
    }
  }
}

