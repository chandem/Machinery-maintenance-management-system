export type User = {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export type DashboardSummary = {
  total_equipment: number;
  operational_equipment: number;
  down_equipment: number;
  open_work_orders: number;
  overdue_maintenance_plans: number;
  low_stock_parts: number;
  out_of_stock_parts: number;
  total_parts_inventory_value: number | null;
};

export type Equipment = {
  id: number;
  asset_code: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  plate_number: string | null;
  status: string;
  hour_meter: number | null;
  odometer: number | null;
  warranty_expiry: string | null;
  notes: string | null;
  category_id: number | null;
  location_id: number | null;
  operator_id: number | null;
  created_at: string;
  updated_at: string;
};

export type MeterReading = {
  id: number;
  equipment_id: number;
  reading_type: string;
  reading_value: number;
  recorded_at: string;
  source: string | null;
  notes: string | null;
};

export type WorkOrder = {
  id: number;
  work_order_number: string;
  equipment_id: number;
  maintenance_plan_id: number | null;
  title: string;
  description: string | null;
  maintenance_type: string;
  priority: string;
  status: string;
  scheduled_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  verified_at: string | null;
  closed_at: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkOrderCost = {
  work_order_id: number;
  estimated_cost: number | null;
  parts_cost: number;
  labor_cost: number;
  total_cost: number;
  recorded_actual_cost: number | null;
};

export type MaintenanceScheduleStatus = {
  id: number;
  equipment_id: number;
  equipment_name: string;
  asset_code: string;
  name: string;
  next_due_date: string | null;
  next_due_meter: number | null;
  current_meter: number | null;
  status: string;
};

export type InventoryStatus = {
  id: number;
  part_id: number;
  part_number: string;
  part_name: string;
  quantity_on_hand: number;
  reorder_level: number;
  status: string;
  location: string | null;
};

export type Part = {
  id: number;
  part_number: string;
  name: string;
  description: string | null;
  unit: string;
  unit_cost: number | null;
  reorder_level: number;
  supplier_id: number | null;
};

/** Allowed next statuses from current work-order status */
export const WO_NEXT: Record<string, string[]> = {
  draft: ["scheduled", "in_progress", "completed", "cancelled"],
  scheduled: ["in_progress", "completed", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: ["verified", "cancelled"],
  verified: ["closed"],
  closed: [],
  cancelled: [],
};
