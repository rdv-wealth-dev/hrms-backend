# Complete Payroll Engine API Reference — Step-by-Step Integration Guide

> **Base URL**: `/api/v1/payroll`  
> **Authentication**: All endpoints require `Authorization: Bearer <jwt_token>` and `x-tenant-id` (or active workspace context).

---

## The Complete Payroll Lifecycle Map

```mermaid
flowchart TD
    subgraph Phase 1: One-Time / Annual Master Setup
        A1["1.1 Calendar & Cut-off Policy"]
        A2["1.2 Salary Components Master"]
        A3["1.3 Multi-Structure Templates & Bulk Assignment"]
        A4["1.4 Statutory Config (PT, LWF, OT)"]
        A5["1.5 Company Policies (Loans & Reimbursements)"]
        A6["1.6 Bank Payout & GL Account Formats"]
        A7["1.7 Payslip Layout Templates"]
    end

    subgraph Phase 2: Monthly Pre-Payroll Processing
        B1["2.1 Attendance Lock (Freeze Days & LOP)"]
        B2["2.2 Overtime Approvals"]
        B3["2.3 Variable & Ad-hoc Adjustments (Bonuses/Deductions)"]
        B4["2.4 Loans & Advances EMI Processing"]
        B5["2.5 Expense Reimbursement Claims"]
        B6["2.6 Arrears Batches (Retroactive Pay)"]
        B7["2.7 Tax Declarations & Investment Proofs"]
        B8["2.8 Consolidated Approvals Inbox"]
    end

    subgraph Phase 3: The 6-Step Controlled Payroll Run
        C1["3.1 Initialize Payroll Run"]
        C2["3.2 Step 1: Attendance Sync & LOP"]
        C3["3.3 Step 2: Wage Inputs & Overtime"]
        C4["3.4 Step 3: Salary Hold & Stop-Payment"]
        C5["3.5 Step 4: Tax & Statutory Overrides"]
        C6["3.6 Step 5: Pre-Flight Validation (Zero-Risk Check)"]
        C7["3.7 Step 6: Compute & Generate Payslips"]
    end

    subgraph Phase 4: Review, Audit & Approval
        D1["4.1 Payslips Directory & Verification"]
        D2["4.2 Period-over-Period Variance & Anomaly Audit"]
        D3["4.3 Final Approval Lock"]
    end

    subgraph Phase 5: Post-Payroll Payout & Statutory Returns
        E1["5.1 Bank Payout File Download"]
        E2["5.2 Mark Run as Paid"]
        E3["5.3 Statutory Filing Files (EPFO ECR, ESIC, PT, TDS)"]
        E4["5.4 GL Accounting Double-Entry Export"]
    end

    subgraph Phase 6: Employee Self-Service & Exit
        F1["6.1 Self-Service Payslip Download"]
        F2["6.2 Form 16 / TDS Certificate"]
        F3["6.3 Full & Final (FnF) Exit Settlement"]
    end

    Phase 1 --> Phase 2 --> Phase 3 --> Phase 4 --> Phase 5
```

---

# PHASE 1: Master Setup (One-Time / Annual HR & Finance Config)

These APIs configure the organization's payroll rules, structure blueprints, compliance slabs, and disbursement channels.

### 1.1 Payroll Calendar & Pay Cycle Policy
Controls pay period start/end days, attendance cut-off dates, and disbursement target days.

| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/calendar-policy` | Fetch active calendar policy | None |
| `POST` | `/calendar-policy` | Create payroll calendar policy | `{ "payCycle": "MONTHLY", "cycleStartDay": 1, "cycleEndDay": 31, "payoutDay": 1, "attendanceCutoffDay": 25 }` |
| `PUT` | `/calendar-policy` | Update payroll calendar policy | Same as POST |
| `GET` | `/calendar-policy/preview` | Preview cut-off dates for a month | Query: `?year=2026&month=9` |

---

### 1.2 Salary Components (Earnings & Deductions Master)
Defines basic, allowances, deductions, formulas, and statutory flags.

| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/components` | List all salary components | Query: `?type=EARNING&isActive=true` |
| `POST` | `/components` | Create component | `{ "name": "House Rent Allowance", "code": "HRA", "type": "EARNING", "calculationType": "PERCENTAGE", "percentageOf": "BASIC", "value": 50, "isTaxable": true }` |
| `PATCH` | `/components/:id` | Update component details | `{ "name": "Revised HRA", "value": 40 }` |
| `DELETE` | `/components/:id` | Delete/deactivate component | None |

---

### 1.3 Multi-Structure Blueprint Templates & Assignment
Allows HR to create standard structure packages (e.g. Executive 50K, Tech Lead 1.5L) and assign them in bulk.

| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/structures/templates` | List all salary templates | None |
| `POST` | `/structures/templates` | Create structure template | `{ "title": "Standard SDE-1", "annualCtc": 1200000, "components": [...] }` |
| `PATCH` | `/structures/templates/:id`| Update structure template | `{ "title": "Updated SDE-1", "annualCtc": 1300000 }` |
| `DELETE` | `/structures/templates/:id`| Delete structure template | None |
| `POST` | `/structures/assign-bulk` | Bulk assign template to employees | `{ "templateId": "...", "employeeIds": ["emp1", "emp2"], "effectiveDate": "2026-04-01" }` |
| `POST` | `/structures` | Assign single employee structure | `{ "employeeId": "...", "annualCtc": 600000, "components": [...] }` |
| `GET` | `/structures/:employeeId` | Fetch employee's assigned structure | None |

---

### 1.4 Statutory Compliance Rules (PT, LWF, Overtime)

#### Professional Tax (PT):
| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/statutory/pt` | List all state PT slabs | None |
| `POST` | `/statutory/pt` | Upsert state PT slab rules | `{ "state": "Maharashtra", "slabs": [{ "minSalary": 0, "maxSalary": 7500, "taxAmount": 0 }, { "minSalary": 7501, "maxSalary": 10000, "taxAmount": 175 }] }` |
| `DELETE` | `/statutory/pt/:id` | Delete state PT slab | None |

#### Labor Welfare Fund (LWF):
| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/statutory/lwf` | List state LWF rules | None |
| `POST` | `/statutory/lwf` | Upsert state LWF config | `{ "state": "Maharashtra", "employeeContribution": 12, "employerContribution": 36, "deductionMonths": [6, 12] }` |

#### Overtime (OT) Rules:
| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/statutory/ot-config` | Get tenant OT calculation rules | None |
| `POST` | `/statutory/ot-config` | Set OT multiplier & policy | `{ "multiplier": 2.0, "calculationBasis": "GROSS", "dailyThresholdHours": 8 }` |

---

### 1.5 Company Policies Setup (Loans & Reimbursements)

#### Loan Policy:
| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/loan-policy` | Get active loan policy | None |
| `POST` | `/loan-policy` | Configure limits & interest | `{ "maxAmountMultiplier": 3, "interestRate": 6.5, "maxTenureMonths": 24 }` |

#### Reimbursement Policy:
| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/reimbursement-policy` | Get expense categories & limits | None |
| `POST` | `/reimbursement-policy` | Upsert category limits | `{ "categories": [{ "code": "TRAVEL", "monthlyLimit": 10000, "requiresReceipt": true }] }` |

---

### 1.6 Bank Payout Formats & General Ledger (GL) Setup

#### Universal Bank Payout Formats:
| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/bank-formats` | List supported bank payout file formats | None |
| `POST` | `/bank-formats` | Create custom bank export mapping | `{ "bankName": "HDFC", "fileType": "CSV", "columns": [...] }` |
| `PATCH` | `/bank-formats/:id` | Update bank payout configuration | Same as POST |
| `DELETE` | `/bank-formats/:id` | Delete bank format | None |

#### General Ledger (GL) Accounting Codes:
| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/gl-config` | Get accounting ledger mapping | None |
| `POST` | `/gl-config` | Set debit/credit accounts | `{ "salaryExpenseAccount": "5001", "pfPayableAccount": "2002", "bankClearingAccount": "1001" }` |

---

### 1.7 Payslip Layout Designer Templates
| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/payslip-templates` | List custom PDF designs | None |
| `POST` | `/payslip-templates` | Create custom payslip layout | `{ "name": "Modern Minimal", "themeColor": "#1E3A8A", "showYTD": true }` |
| `PATCH` | `/payslip-templates/:id` | Update layout template | Same as POST |
| `PATCH` | `/payslip-templates/:id/set-default` | Set template as organization default | None |
| `POST` | `/payslip-templates/default` | Alternative set default endpoint | `{ "templateId": "..." }` |
| `DELETE` | `/payslip-templates/:id` | Delete layout template | None |

---

# PHASE 2: Monthly Pre-Payroll Processing (Gathering Variables)

Before executing the monthly payroll run, HR and Managers finalize cut-offs, variable pay, and approvals.

### 2.1 Attendance Lock (Freeze Cut-Off)
Freezes attendance so late check-ins don't distort payroll calculations.

| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/attendance-lock/status/:year/:month` | Check if period is locked | None |
| `GET` | `/attendance-lock/year/:year` | 12-month lock calendar overview | None |
| `POST` | `/attendance-lock/lock` | Lock attendance for the cycle | `{ "year": 2026, "month": 9, "lockReason": "September Payroll Cutoff" }` |
| `POST` | `/attendance-lock/unlock` | Unlock attendance (if not paid) | `{ "year": 2026, "month": 9, "reason": "Late regularization by HR Admin" }` |

---

### 2.2 Overtime Approvals
| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/overtime/pending/:year/:month` | List pending OT hours to approve | None |
| `GET` | `/overtime/employee/:employeeId/:year/:month` | Detailed OT sessions of an employee | None |
| `PATCH` | `/overtime/:id/approve` | Approve OT record | None |
| `PATCH` | `/overtime/:id/reject` | Reject OT record | `{ "rejectionReason": "Exceeded pre-authorized hours" }` |

---

### 2.3 Variable & Ad-Hoc Adjustments (Bonuses, Fines, Deductions)
| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/adjustments` | List all adjustments with filters | Query: `?year=2026&month=9&status=PENDING` |
| `GET` | `/adjustments/:id` | Get adjustment detail | None |
| `POST` | `/adjustments` | Add single bonus/deduction | `{ "employeeId": "...", "type": "ADDITION", "amount": 5000, "category": "PERFORMANCE_BONUS", "year": 2026, "month": 9 }` |
| `POST` | `/adjustments/bulk` | Bulk upload multiple adjustments | `{ "adjustments": [...] }` |
| `PATCH` | `/adjustments/:id/approve` | Approve adjustment | None |
| `PATCH` | `/adjustments/:id/reject` | Reject adjustment | `{ "rejectionReason": "Duplicate request" }` |
| `DELETE` | `/adjustments/:id` | Delete draft adjustment | None |

---

### 2.4 Loans & Salary Advances (EMIs)
| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/loans` | List all employee loans & advances | Query: `?status=ACTIVE` |
| `GET` | `/loans/:id` | Get loan application details | None |
| `GET` | `/loans/:id/schedule` | View EMI amortization schedule | None |
| `POST` | `/loans` | Apply for loan / advance | `{ "employeeId": "...", "principalAmount": 50000, "tenureMonths": 10, "disbursementDate": "2026-09-01" }` |
| `PATCH` | `/loans/:id` | Update terms | `{ "tenureMonths": 12 }` |
| `PATCH` | `/loans/:id/approve` | Approve loan (activates monthly EMI) | None |
| `PATCH` | `/loans/:id/reject` | Reject loan application | None |
| `DELETE` | `/loans/:id` | Delete/cancel loan | None |
| `GET` | `/loans/me` | Employee self-service personal loans | None |

---

### 2.5 Expense Reimbursements
| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/reimbursements` | List claims across organization | Query: `?status=SUBMITTED` |
| `GET` | `/reimbursements/:id` | View claim details & bill receipts | None |
| `GET` | `/reimbursements/summary/:employeeId` | Check employee's yearly spending | None |
| `PATCH` | `/reimbursements/:id/approve` | Approve claim for payroll payout | None |
| `PATCH` | `/reimbursements/:id/reject` | Reject claim with reason | None |
| `POST` | `/reimbursements` | Submit new expense claim | `{ "category": "TRAVEL", "amount": 2500, "expenseDate": "2026-09-05", "receiptUrl": "..." }` |
| `DELETE` | `/reimbursements/:id` | Cancel personal draft claim | None |
| `GET` | `/reimbursements/me` | Employee self-service personal claims | None |

---

### 2.6 Arrears Batches (Retroactive Pay Revisions)
| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `POST` | `/arrears/batches` | Create retroactive arrears batch | `{ "name": "Q1 Appraisal Increment", "effectiveFromYear": 2026, "effectiveFromMonth": 4, "payoutYear": 2026, "payoutMonth": 9, "employeeIds": [...] }` |
| `GET` | `/arrears/batches` | List arrears batches | None |
| `GET` | `/arrears/batches/:id` | View arrears breakdown per employee | None |
| `PATCH` | `/arrears/batches/:id/process`| Finalize & queue for payroll run | None |

---

### 2.7 Tax Declarations (Section 80C, 80D, HRA)
| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `POST` | `/tax-declaration` | Employee submits regime & 80C/80D | `{ "financialYear": "2026-2027", "regime": "NEW", "section80C": { "ppf": 50000, "elss": 20000 } }` |
| `GET` | `/tax-declaration/:financialYear` | Get employee's declaration | None |
| `PATCH` | `/tax-declaration/:financialYear/proof` | Mark investment proofs submitted | `{ "documentUrls": [...] }` |

---

### 2.8 Consolidated Approvals Inbox
| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/approvals` | Unified manager/HR inbox of all pending items (OT, Loans, Claims, Adjustments) | None |

---

# PHASE 3: The 6-Step Controlled Payroll Run Pipeline

This is the interactive step-by-step wizard the HR Admin follows each month:

```text
Run Dashboard -> [Step 1: Attendance] -> [Step 2: Wages] -> [Step 3: Hold] -> [Step 4: Tax] -> [Step 5: Pre-Flight] -> [Step 6: Compute]
```

### 3.1 Initialize Payroll Run
| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `POST` | `/runs` | Initialize a new payroll run | `{ "year": 2026, "month": 9, "branchId": "...", "payrollType": "REGULAR" }` |
| `GET` | `/runs` | List all historical and active runs | None |
| `GET` | `/runs/:id` | Get details and pipeline progress | None |

---

### 3.2 Step 1 — Attendance & LOP Sync
| Method | Endpoint | Description | Response Details |
| :--- | :--- | :--- | :--- |
| `GET` | `/runs/:id/steps/attendance-sync` | Review synced attendance days, paid holidays, and LOP count for all employees | Returns array of employees with `presentDays`, `lopDays`, `leaveDays`, and sync warnings. |

---

### 3.3 Step 2 — Wage Inputs (Variable Pay & Overtime)
| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `POST` | `/runs/:id/steps/wage-inputs` | Confirm and save variable earnings for this run | `{ "inputs": [{ "employeeId": "...", "overtimeHours": 10, "incentives": 5000, "productionBonus": 2000 }] }` |

---

### 3.4 Step 3 — Salary Hold (Stop-Payment)
For employees under review, absconding, or missing critical documents.

| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `POST` | `/runs/:id/steps/hold-salary` | Put specific employees on hold | `{ "holds": [{ "employeeId": "...", "isHeld": true, "holdReason": "Pending Clearance" }] }` |

---

### 3.5 Step 4 — Tax & Statutory Overrides
| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `POST` | `/runs/:id/steps/tax-override` | Apply manual TDS overrides | `{ "overrides": [{ "employeeId": "...", "tdsOverride": 3500, "reason": "Higher bonus tax" }] }` |

---

### 3.6 Step 5 — Pre-Flight Validation (Zero-Risk Check)
Surfaces every missing bank account, PAN error, or missing salary structure *before* computation starts.

| Method | Endpoint | Description | Response Details |
| :--- | :--- | :--- | :--- |
| `POST` | `/runs/:id/validate` | Run automated pre-flight audit | Returns `{ "isValid": true, "errors": [], "warnings": [] }` |

---

### 3.7 Step 6 — Compute & Generate Payslips
| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `POST` | `/runs/:id/generate` | Trigger payroll computation engine | None *(Rate-limited to 2 per 5 min)* |
| `POST` | `/runs/:id/generate-batch` | High-volume batch generation for enterprises | `{ "batchSize": 200 }` |

---

# PHASE 4: Review, Variance Audit & Final Approval

### 4.1 Payslip Directory & Employee Payslips
| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/runs/:id/payslips` | List all calculated payslips in this run | Query: `?search=&page=1&limit=25` |
| `GET` | `/payslips` | Global filterable directory | Query: `?year=2026&month=9&branchId=...` |
| `GET` | `/payslips/:id` | Full payslip details (Earnings, Deductions, YTD, Net) | None |

---

### 4.2 Period-over-Period Variance Report
Highlights anomalous changes from the previous month (e.g. Net Pay spiked >20%, unexpected LOP deductions, new joiner salary comparison).

| Method | Endpoint | Description | Response Details |
| :--- | :--- | :--- | :--- |
| `GET` | `/runs/:id/variance-report` | Comprehensive variance audit | Returns component-by-component variance, total cost delta, and flagged anomalies. |

---

### 4.3 Final Approval
| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `PATCH` | `/runs/:id/approve` | Final management approval | `{ "comments": "Approved by Finance Director" }` *(Rate-limited)* |

---

# PHASE 5: Post-Payroll Payout & Statutory Returns

### 5.1 Bank Disbursement (Salary Direct Transfer)
| Method | Endpoint | Description | Response Details |
| :--- | :--- | :--- | :--- |
| `GET` | `/runs/:id/disbursement/summary` | Bank payout summary | Count of accounts, total net payout, bank-wise breakdown |
| `GET` | `/runs/:id/disbursement/download` | Download default bank transfer file | CSV / Excel file stream |
| `GET` | `/runs/:id/payout/export` | Download custom bank payout file | Query: `?bankFormatId=...` |

---

### 5.2 Mark Run as Paid
| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `PATCH` | `/runs/:id/paid` | Mark run as PAID | `{ "paidDate": "2026-09-30", "paymentReference": "NEFT-BATCH-9941" }` |
> **Safety Guard**: Once marked as Paid, attendance unlock for this period is permanently prevented.

---

### 5.3 Statutory Filing Returns (Government Portals)
| Method | Endpoint | Description | File Type / Format |
| :--- | :--- | :--- | :--- |
| `GET` | `/runs/:id/statutory/epf-ecr` | EPFO monthly return | JSON / Excel |
| `GET` | `/runs/:id/statutory/epfo-ecr-txt` | Raw EPFO ECR text format | Direct text file ready for EPFO Employer portal |
| `GET` | `/runs/:id/statutory/esic` | ESIC monthly statement | JSON / Excel |
| `GET` | `/runs/:id/statutory/esic-csv` | ESIC CSV format | Ready for ESIC portal upload |
| `GET` | `/runs/:id/statutory/pt` | State Professional Tax statement | Detailed PT report by state |
| `GET` | `/runs/:id/statutory/tds` | Form 24Q Quarterly TDS statement | Annexure text / JSON for TRACES |

---

### 5.4 General Ledger (GL) Accounting Export
| Method | Endpoint | Description | Response Details |
| :--- | :--- | :--- | :--- |
| `GET` | `/runs/:id/gl-journal` | Double-entry journal voucher | Debit: Salary Expenses, Credits: Bank, PF Payable, ESIC Payable, TDS Payable |

---

# PHASE 6: Employee Self-Service & Year-End Tax

### 6.1 Employee Self-Service (ESS)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/payslips/me` | Employee lists their own payslips (Month, Year, Net Pay) |
| `GET` | `/payslips/me/:id` | Download personal payslip PDF |

### 6.2 Year-End Tax Certificate (Form 16)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/statutory/form16` | Download Form 16 Part A & Part B TDS Certificate (Query: `?financialYear=2026-2027&employeeId=...`) |

---

# PHASE 7: Full & Final Settlement (FnF - Employee Exit)

When an employee resigns or exits the organization:

| Method | Endpoint | Description | Payload Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/fnf/:employeeId/compute` | Preview FnF calculations (Notice pay, leave encashment, gratuity, pending loan balance) | None |
| `POST` | `/fnf/:employeeId/process` | Execute and lock FnF settlement | `{ "exitDate": "2026-09-30", "encashLeaveDays": 12, "gratuityAmount": 55000, "deductions": 2000 }` |
| `GET` | `/fnf` | List all processed settlements | Query: `?year=2026&status=PROCESSED` |
| `GET` | `/fnf/:id` | View full settlement voucher | None |
