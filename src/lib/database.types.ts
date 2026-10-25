
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity_events": {
                  Row: {
                    "actor_member_id": string | null,"created_at": string,"entity_id": string | null,"entity_type": string,"event_type": string,"household_id": string,"id": string,"metadata": NonNullable<Json>,"recipient_member_ids": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_member_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"event_type": string,"household_id": string,"id"?: string,"metadata"?: NonNullable<Json>,"recipient_member_ids"?: (string)[]
                  }
                  Update: {
                    "actor_member_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"event_type"?: string,"household_id"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"recipient_member_ids"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_events_actor_member_id_household_id_fkey"
      columns: ["actor_member_id","household_id"]
isOneToOne: false
      referencedRelation: "household_members"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "activity_events_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"activity_reads": {
                  Row: {
                    "event_id": string,"member_id": string,"read_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"member_id": string,"read_at"?: string
                  }
                  Update: {
                    "event_id"?: string,"member_id"?: string,"read_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_reads_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "activity_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_reads_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "household_members"
      referencedColumns: ["id"]
    }
                  ]
                },"announcements": {
                  Row: {
                    "body": string,"created_at": string,"created_by": string,"deleted_at": string | null,"household_id": string,"id": string,"pinned_at": string | null,"title": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"created_by": string,"deleted_at"?: string | null,"household_id": string,"id"?: string,"pinned_at"?: string | null,"title": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"created_by"?: string,"deleted_at"?: string | null,"household_id"?: string,"id"?: string,"pinned_at"?: string | null,"title"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_events": {
                  Row: {
                    "action": string,"actor_member_id": string | null,"after": Json | null,"before": Json | null,"created_at": string,"entity_id": string,"entity_type": string,"household_id": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_member_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"entity_id": string,"entity_type": string,"household_id": string,"id"?: string
                  }
                  Update: {
                    "action"?: string,"actor_member_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"entity_id"?: string,"entity_type"?: string,"household_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_events_actor_member_id_household_id_fkey"
      columns: ["actor_member_id","household_id"]
isOneToOne: false
      referencedRelation: "household_members"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "audit_events_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"chore_completions": {
                  Row: {
                    "assignee_member_id": string | null,"chore_id": string,"chore_title": string,"completed_at": string,"completed_by_member_id": string,"created_at": string,"due_date": string | null,"household_id": string,"id": string,"reopened_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_member_id"?: string | null,"chore_id": string,"chore_title": string,"completed_at"?: string,"completed_by_member_id": string,"created_at"?: string,"due_date"?: string | null,"household_id": string,"id"?: string,"reopened_at"?: string | null
                  }
                  Update: {
                    "assignee_member_id"?: string | null,"chore_id"?: string,"chore_title"?: string,"completed_at"?: string,"completed_by_member_id"?: string,"created_at"?: string,"due_date"?: string | null,"household_id"?: string,"id"?: string,"reopened_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "chore_completions_assignee_member_id_household_id_fkey"
      columns: ["assignee_member_id","household_id"]
isOneToOne: false
      referencedRelation: "household_members"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "chore_completions_chore_id_household_id_fkey"
      columns: ["chore_id","household_id"]
isOneToOne: false
      referencedRelation: "chores"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "chore_completions_completed_by_member_id_household_id_fkey"
      columns: ["completed_by_member_id","household_id"]
isOneToOne: false
      referencedRelation: "household_members"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"chores": {
                  Row: {
                    "assignee_member_id": string | null,"cancel_reason": string | null,"completed_at": string | null,"completed_by": string | null,"created_at": string,"created_by": string,"description": string | null,"due_date": string | null,"household_id": string,"id": string,"recurrence_frequency": string | null,"rotation_member_ids": (string)[] | null,"spawned_next_id": string | null,"status": string,"title": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_member_id"?: string | null,"cancel_reason"?: string | null,"completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"created_by": string,"description"?: string | null,"due_date"?: string | null,"household_id": string,"id"?: string,"recurrence_frequency"?: string | null,"rotation_member_ids"?: (string)[] | null,"spawned_next_id"?: string | null,"status"?: string,"title": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "assignee_member_id"?: string | null,"cancel_reason"?: string | null,"completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"created_by"?: string,"description"?: string | null,"due_date"?: string | null,"household_id"?: string,"id"?: string,"recurrence_frequency"?: string | null,"rotation_member_ids"?: (string)[] | null,"spawned_next_id"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "chores_assignee_member_id_household_id_fkey"
      columns: ["assignee_member_id","household_id"]
isOneToOne: false
      referencedRelation: "household_members"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "chores_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chores_spawned_next_id_fkey"
      columns: ["spawned_next_id"]
isOneToOne: false
      referencedRelation: "chores"
      referencedColumns: ["id"]
    }
                  ]
                },"expense_shares": {
                  Row: {
                    "created_at": string,"expense_id": string,"household_id": string,"member_id": string,"percent_bp": number | null,"share_amount_minor": number,"split_method": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expense_id": string,"household_id": string,"member_id": string,"percent_bp"?: number | null,"share_amount_minor": number,"split_method": string
                  }
                  Update: {
                    "created_at"?: string,"expense_id"?: string,"household_id"?: string,"member_id"?: string,"percent_bp"?: number | null,"share_amount_minor"?: number,"split_method"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_shares_expense_id_household_id_fkey"
      columns: ["expense_id","household_id"]
isOneToOne: false
      referencedRelation: "expenses"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "expense_shares_member_id_household_id_fkey"
      columns: ["member_id","household_id"]
isOneToOne: false
      referencedRelation: "household_members"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "amount_minor": number,"category": string,"created_at": string,"created_by": string,"currency_code": string,"deleted_at": string | null,"deleted_by": string | null,"expense_date": string,"household_id": string,"id": string,"notes": string | null,"paid_by_member_id": string,"split_method": string,"title": string,"updated_at": string,"updated_by": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"category"?: string,"created_at"?: string,"created_by": string,"currency_code": string,"deleted_at"?: string | null,"deleted_by"?: string | null,"expense_date": string,"household_id": string,"id"?: string,"notes"?: string | null,"paid_by_member_id": string,"split_method": string,"title": string,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Update: {
                    "amount_minor"?: number,"category"?: string,"created_at"?: string,"created_by"?: string,"currency_code"?: string,"deleted_at"?: string | null,"deleted_by"?: string | null,"expense_date"?: string,"household_id"?: string,"id"?: string,"notes"?: string | null,"paid_by_member_id"?: string,"split_method"?: string,"title"?: string,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_paid_by_member_id_household_id_fkey"
      columns: ["paid_by_member_id","household_id"]
isOneToOne: false
      referencedRelation: "household_members"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"grocery_items": {
                  Row: {
                    "added_by_member_id": string,"category": string | null,"created_at": string,"deleted_at": string | null,"household_id": string,"id": string,"name": string,"note": string | null,"purchased_at": string | null,"purchased_by_member_id": string | null,"quantity": number | null,"status": string,"unit": string | null,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by_member_id": string,"category"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"household_id": string,"id"?: string,"name": string,"note"?: string | null,"purchased_at"?: string | null,"purchased_by_member_id"?: string | null,"quantity"?: number | null,"status"?: string,"unit"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "added_by_member_id"?: string,"category"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"household_id"?: string,"id"?: string,"name"?: string,"note"?: string | null,"purchased_at"?: string | null,"purchased_by_member_id"?: string | null,"quantity"?: number | null,"status"?: string,"unit"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "grocery_items_added_by_member_id_household_id_fkey"
      columns: ["added_by_member_id","household_id"]
isOneToOne: false
      referencedRelation: "household_members"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "grocery_items_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "grocery_items_purchased_by_member_id_household_id_fkey"
      columns: ["purchased_by_member_id","household_id"]
isOneToOne: false
      referencedRelation: "household_members"
      referencedColumns: ["id","household_id"]
    }
                  ]
                },"household_members": {
                  Row: {
                    "created_at": string,"household_id": string,"id": string,"joined_at": string,"left_at": string | null,"move_out_acknowledged_balance_minor": number | null,"move_out_effective_date": string | null,"move_out_note": string | null,"move_out_requested_at": string | null,"move_out_requested_by": string | null,"role": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"household_id": string,"id"?: string,"joined_at"?: string,"left_at"?: string | null,"move_out_acknowledged_balance_minor"?: number | null,"move_out_effective_date"?: string | null,"move_out_note"?: string | null,"move_out_requested_at"?: string | null,"move_out_requested_by"?: string | null,"role"?: string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"household_id"?: string,"id"?: string,"joined_at"?: string,"left_at"?: string | null,"move_out_acknowledged_balance_minor"?: number | null,"move_out_effective_date"?: string | null,"move_out_note"?: string | null,"move_out_requested_at"?: string | null,"move_out_requested_by"?: string | null,"role"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_members_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "household_members_move_out_requested_by_fkey"
      columns: ["move_out_requested_by"]
isOneToOne: false
      referencedRelation: "household_members"
      referencedColumns: ["id"]
    }
                  ]
                },"households": {
                  Row: {
                    "chore_reminders_enabled": boolean,"created_at": string,"created_by": string,"currency_code": string,"default_split": string,"id": string,"name": string,"status": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "chore_reminders_enabled"?: boolean,"created_at"?: string,"created_by": string,"currency_code"?: string,"default_split"?: string,"id"?: string,"name": string,"status"?: string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "chore_reminders_enabled"?: boolean,"created_at"?: string,"created_by"?: string,"currency_code"?: string,"default_split"?: string,"id"?: string,"name"?: string,"status"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"invitations": {
                  Row: {
                    "code_hash": string,"code_hint": string,"created_at": string,"created_by": string,"expires_at": string,"household_id": string,"id": string,"max_uses": number | null,"status": string,"use_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code_hash": string,"code_hint": string,"created_at"?: string,"created_by": string,"expires_at": string,"household_id": string,"id"?: string,"max_uses"?: number | null,"status"?: string,"use_count"?: number
                  }
                  Update: {
                    "code_hash"?: string,"code_hint"?: string,"created_at"?: string,"created_by"?: string,"expires_at"?: string,"household_id"?: string,"id"?: string,"max_uses"?: number | null,"status"?: string,"use_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"invite_attempts": {
                  Row: {
                    "attempted_at": string,"id": string,"succeeded": boolean,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempted_at"?: string,"id"?: string,"succeeded": boolean,"user_id": string
                  }
                  Update: {
                    "attempted_at"?: string,"id"?: string,"succeeded"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"member_move_out_disputes": {
                  Row: {
                    "created_at": string,"id": string,"member_id": string,"note": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"member_id": string,"note": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"member_id"?: string,"note"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_move_out_disputes_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "household_members"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_prefs": {
                  Row: {
                    "categories": NonNullable<Json>,"member_id": string,"quiet_enabled": boolean,"quiet_end": string | null,"quiet_start": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "categories"?: NonNullable<Json>,"member_id": string,"quiet_enabled"?: boolean,"quiet_end"?: string | null,"quiet_start"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "categories"?: NonNullable<Json>,"member_id"?: string,"quiet_enabled"?: boolean,"quiet_end"?: string | null,"quiet_start"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_prefs_member_id_fkey"
      columns: ["member_id"]
isOneToOne: true
      referencedRelation: "household_members"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_color": string,"created_at": string,"display_name": string,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_color"?: string,"created_at"?: string,"display_name": string,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_color"?: string,"created_at"?: string,"display_name"?: string,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"settlements": {
                  Row: {
                    "amount_minor": number,"created_at": string,"currency_code": string,"from_member_id": string,"household_id": string,"id": string,"note": string | null,"recorded_by": string,"settlement_date": string,"status": string,"status_changed_at": string | null,"status_changed_by": string | null,"status_reason": string | null,"to_member_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"created_at"?: string,"currency_code": string,"from_member_id": string,"household_id": string,"id"?: string,"note"?: string | null,"recorded_by": string,"settlement_date": string,"status"?: string,"status_changed_at"?: string | null,"status_changed_by"?: string | null,"status_reason"?: string | null,"to_member_id": string,"version"?: number
                  }
                  Update: {
                    "amount_minor"?: number,"created_at"?: string,"currency_code"?: string,"from_member_id"?: string,"household_id"?: string,"id"?: string,"note"?: string | null,"recorded_by"?: string,"settlement_date"?: string,"status"?: string,"status_changed_at"?: string | null,"status_changed_by"?: string | null,"status_reason"?: string | null,"to_member_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "settlements_from_member_id_household_id_fkey"
      columns: ["from_member_id","household_id"]
isOneToOne: false
      referencedRelation: "household_members"
      referencedColumns: ["id","household_id"]
    },{
      foreignKeyName: "settlements_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "settlements_to_member_id_household_id_fkey"
      columns: ["to_member_id","household_id"]
isOneToOne: false
      referencedRelation: "household_members"
      referencedColumns: ["id","household_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_expense":
{ Args: { "p_amount_minor": number,"p_category": string,"p_expense_date": string,"p_household_id": string,"p_notes"?: string,"p_paid_by_member_id": string,"p_shares": Json,"p_split_method": string,"p_title": string }; Returns: string
                           },
"add_move_out_dispute":
{ Args: { "p_member_id": string,"p_note": string }; Returns: string
                           },
"cancel_move_out":
{ Args: { "p_member_id": string }; Returns: undefined
                           },
"complete_chore":
{ Args: { "p_chore_id": string,"p_expected_version"?: number }; Returns: Json
                           },
"create_household":
{ Args: { "p_chore_reminders"?: boolean,"p_currency_code"?: string,"p_default_split"?: string,"p_name": string }; Returns: string
                           },
"create_invite":
{ Args: { "p_expires_in_hours"?: number,"p_household_id": string,"p_max_uses"?: number }; Returns: Json
                           },
"delete_expense":
{ Args: { "p_expected_version"?: number,"p_expense_id": string }; Returns: number
                           },
"edit_expense":
{ Args: { "p_amount_minor": number,"p_category": string,"p_expected_version": number,"p_expense_date": string,"p_expense_id": string,"p_notes"?: string,"p_paid_by_member_id": string,"p_shares": Json,"p_split_method": string,"p_title": string }; Returns: Json
                           },
"export_my_household_data":
{ Args: { "p_household_id": string }; Returns: Json
                           },
"health":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"household_balances":
{ Args: { "p_household_id": string }; Returns: {
              "member_id": string,"net_minor": number
            }[]
                           },
"join_household":
{ Args: { "p_code": string }; Returns: Json
                           },
"mark_activity_read":
{ Args: { "p_event_id": string }; Returns: undefined
                           },
"mark_all_activity_read":
{ Args: { "p_household_id": string }; Returns: number
                           },
"preview_invite":
{ Args: { "p_code": string }; Returns: Json
                           },
"reconcile_household":
{ Args: { "p_household_id": string }; Returns: number
                           },
"record_settlement":
{ Args: { "p_amount_minor": number,"p_from_member_id": string,"p_household_id": string,"p_note"?: string,"p_settlement_date": string,"p_to_member_id": string }; Returns: string
                           },
"reopen_chore":
{ Args: { "p_chore_id": string }; Returns: Json
                           },
"restore_expense":
{ Args: { "p_expense_id": string }; Returns: number
                           },
"revoke_invite":
{ Args: { "p_invite_id": string }; Returns: undefined
                           },
"set_household_archived":
{ Args: { "p_archived": boolean,"p_expected_version"?: number,"p_household_id": string }; Returns: number
                           },
"set_member_role":
{ Args: { "p_member_id": string,"p_role": string }; Returns: undefined
                           },
"set_settlement_status":
{ Args: { "p_expected_version"?: number,"p_reason"?: string,"p_settlement_id": string,"p_status": string }; Returns: number
                           },
"start_move_out":
{ Args: { "p_acknowledged_balance_minor"?: number,"p_effective_date": string,"p_member_id": string,"p_note"?: string }; Returns: undefined
                           },
"sync_chore_reminders":
{ Args: { "p_household_id": string,"p_today"?: string }; Returns: number
                           },
"transfer_ownership":
{ Args: { "p_member_id": string }; Returns: undefined
                           },
"update_household":
{ Args: { "p_chore_reminders"?: boolean,"p_currency_code"?: string,"p_default_split"?: string,"p_expected_version": number,"p_household_id": string,"p_name"?: string }; Returns: number
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
