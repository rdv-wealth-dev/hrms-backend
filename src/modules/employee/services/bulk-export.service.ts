import { Response } from "express";
import mongoose from "mongoose";    
import ExcelJS from "exceljs";
import { RequestContext } from "../../../core/interfaces/request-context.interface";
import { EmployeeModel } from "../core/employee.model";

export class BulkExportService {
  /**
   * Stream Employee Records to CSV (O(1) Heap Footprint)
   */
  async streamEmployeesCSV(context: RequestContext, res: Response, filters: Record<string, any> = {}): Promise<void> {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="employees_export_${Date.now()}.csv"`);

    // Write CSV Headers
    res.write("Employee Code,First Name,Last Name,Email,Phone,Branch,Department,Designation,Status,Joining Date,Employee Type\n");

    const query = {
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
      ...filters,
    };

    // Use Mongoose Cursor to stream records sequentially
    const cursor = EmployeeModel.find(query)
      .populate("branchId", "name")
      .populate("departmentId", "name")
      .populate("designationId", "name")
      .lean()
      .cursor();

    for await (const emp of cursor) {
      const branchName = (emp.branchId as any)?.name || "";
      const deptName = (emp.departmentId as any)?.name || "";
      const desigName = (emp.designationId as any)?.name || "";
      const joiningDate = emp.joiningDate ? new Date(emp.joiningDate).toISOString().split("T")[0] : "";

      const csvLine = [
        `"${emp.employeeCode || ""}"`,
        `"${emp.firstName || ""}"`,
        `"${emp.lastName || ""}"`,
        `"${emp.email || ""}"`,
        `"${emp.phone || ""}"`,
        `"${branchName}"`,
        `"${deptName}"`,
        `"${desigName}"`,
        `"${emp.status || ""}"`,
        `"${joiningDate}"`,
        `"${emp.employeeType || ""}"`,
      ].join(",") + "\n";

      if (!res.write(csvLine)) {
        await new Promise((resolve) => res.once("drain", resolve));
      }
    }

    res.end();
  }

  /**
   * Export Employee Records to Excel Workbook
   */
  async exportEmployeesExcel(context: RequestContext, res: Response, filters: Record<string, any> = {}): Promise<void> {
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
    const worksheet = workbook.addWorksheet("Employees");

    worksheet.columns = [
      { header: "Employee Code", key: "employeeCode", width: 15 },
      { header: "First Name", key: "firstName", width: 20 },
      { header: "Last Name", key: "lastName", width: 20 },
      { header: "Email", key: "email", width: 30 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "Branch", key: "branch", width: 20 },
      { header: "Department", key: "department", width: 20 },
      { header: "Designation", key: "designation", width: 25 },
      { header: "Status", key: "status", width: 15 },
      { header: "Joining Date", key: "joiningDate", width: 15 },
      { header: "Employee Type", key: "employeeType", width: 15 },
    ];

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="employees_export_${Date.now()}.xlsx"`);

    const query = {
      tenantId: new mongoose.Types.ObjectId(context.tenantId),
      isDeleted: false,
      ...filters,
    };

    const cursor = EmployeeModel.find(query)
      .populate("branchId", "name")
      .populate("departmentId", "name")
      .populate("designationId", "name")
      .lean()
      .cursor();

    for await (const emp of cursor) {
      worksheet.addRow({
        employeeCode: emp.employeeCode,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        phone: emp.phone || "",
        branch: (emp.branchId as any)?.name || "",
        department: (emp.departmentId as any)?.name || "",
        designation: (emp.designationId as any)?.name || "",
        status: emp.status,
        joiningDate: emp.joiningDate ? new Date(emp.joiningDate).toISOString().split("T")[0] : "",
        employeeType: emp.employeeType,
      }).commit();
    }

    await worksheet.commit();
    res.end();
  }
}