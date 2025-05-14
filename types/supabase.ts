export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          organization_id: string;
          role: string;
          full_name: string;
          updated_at: string;
          onboarding_status: string;
        };
        Insert: {
          id: string;
          organization_id: string;
          role?: string;
          full_name?: string;
          updated_at?: string;
          onboarding_status?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          role?: string;
          full_name?: string;
          updated_at?: string;
          onboarding_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      // Define your other tables here
    };
    Views: {
      [_ in string]: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Functions: {
      [_ in string]: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
    };
    Enums: {
      [_ in string]: string[];
    };
  };
}
