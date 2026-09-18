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
  category_id: number | null;
  location_id: number | null;
  operator_id: number | null;
  created_at: string;
  updated_at: string;
};

export type WorkOrder = {
  id: number;
  work_order_number: string;
  equipment_id: number;
  title: string;
  description: string | null;
  maintenance_type: string;
  priority: string;
  status: string;
  scheduled_date: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  created_at: string;
  updated_at: string;
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
