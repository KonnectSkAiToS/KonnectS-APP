import { useMemo } from 'react';

export interface WorkerValidationFields {
  // ID Verification
  hasIdProof: boolean;
  idPhotoUrl?: string | null;
  
  // Vehicle Verification
  licenseNumber: string;
  vehicleRegistration: string;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  hasVehicleDocs: boolean;
  
  // Work History & Capability
  jobsSelected: string[];
  workHistory: Array<{
    title: string;
    employer: string;
    duration: string;
    details: string;
  }>;
}

export function useWorkerFormValidation(fields: WorkerValidationFields) {
  const errors = useMemo(() => {
    const newErrors: Record<string, string> = {};

    // 1. Identity Verification
    if (!fields.hasIdProof) {
      newErrors.idProof = "Proof of Identity (Passport or ID card scan/photo) is required.";
    }

    // 2. Vehicle Verification (Required for Rides/Cab operations)
    if (!fields.licenseNumber || fields.licenseNumber.trim().length < 6) {
      newErrors.licenseNumber = "A valid UK Driving License number is required.";
    }
    if (!fields.vehicleRegistration || fields.vehicleRegistration.trim().length < 4) {
      newErrors.vehicleRegistration = "Vehicle registration plate is required.";
    }
    if (!fields.insuranceProvider || fields.insuranceProvider.trim().length === 0) {
      newErrors.insuranceProvider = "Insurance provider name is required.";
    }
    if (!fields.insurancePolicyNumber || fields.insurancePolicyNumber.trim().length === 0) {
      newErrors.insurancePolicyNumber = "Insurance policy number is required.";
    }
    if (!fields.hasVehicleDocs) {
      newErrors.vehicleDocs = "Please upload or snap a photo of your vehicle registration / insurance documents.";
    }

    // 3. Work History & Capabilities
    if (!fields.jobsSelected || fields.jobsSelected.length === 0) {
      newErrors.jobsSelected = "Please select at least one job capability you can perform.";
    }
    if (!fields.workHistory || fields.workHistory.length === 0) {
      newErrors.workHistory = "Please add at least one entry of past professional work history.";
    } else {
      const emptyItem = fields.workHistory.some(item => 
        !item.title.trim() || !item.employer.trim() || !item.duration.trim()
      );
      if (emptyItem) {
        newErrors.workHistoryDetails = "All work history entries must have a job title, employer, and duration.";
      }
    }

    return newErrors;
  }, [
    fields.hasIdProof,
    fields.idPhotoUrl,
    fields.licenseNumber,
    fields.vehicleRegistration,
    fields.insuranceProvider,
    fields.insurancePolicyNumber,
    fields.hasVehicleDocs,
    fields.jobsSelected,
    fields.workHistory
  ]);

  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  return {
    errors,
    isValid,
    errorCount: Object.keys(errors).length
  };
}
