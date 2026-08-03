import { api } from "./api";

export interface CertificateStudent {
  id: number;
  lrn: string;
  name: string;
  grade_level: number;
  sex: string;
  birthdate: string;
  address: string;
  guardian: string;
}

export interface CertificateEnrollment {
  id: number;
  enrollment_date: string;
  status: string;
  remarks: string | null;
  section_name: string;
  adviser_name: string;
}

export interface CertificateSchool {
  school_name: string;
  school_id: string;
  region: string;
  division: string;
  district: string | null;
}

export interface CertificateResponse {
  form: string;
  school: CertificateSchool | null;
  student: CertificateStudent;
  enrollment: CertificateEnrollment | null;
  school_year: string | null;
}

export const certificatesApi = {
  enrollment: (studentId: number, schoolYearId?: number) =>
    api.get<CertificateResponse>(`/certificates/enrollment?student_id=${studentId}${schoolYearId ? `&school_year_id=${schoolYearId}` : ""}`),

  goodMoral: (studentId: number, schoolYearId?: number) =>
    api.get<CertificateResponse>(`/certificates/good-moral?student_id=${studentId}${schoolYearId ? `&school_year_id=${schoolYearId}` : ""}`),
};
