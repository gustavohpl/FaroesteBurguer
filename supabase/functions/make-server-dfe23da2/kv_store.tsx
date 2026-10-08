import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const client = () => createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
);

export const set = async (key: string, value: any): Promise<void> => {
  const supabase = client()
  const { error } = await supabase.from("kv_store_dfe23da2").upsert({
    key,
    value
  });
  if (error) {
    throw new Error(error.message);
  }
};

export const get = async (key: string): Promise<any> => {
  const supabase = client()
  const { data, error } = await supabase.from("kv_store_dfe23da2").select("value").eq("key", key).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data?.value;
};

export const del = async (key: string): Promise<void> => {
  const supabase = client()
  const { error } = await supabase.from("kv_store_dfe23da2").delete().eq("key", key);
  if (error) {
    throw new Error(error.message);
  }
};

export const mset = async (keys: string[], values: any[]): Promise<void> => {
  const supabase = client()
  const { error } = await supabase.from("kv_store_dfe23da2").upsert(keys.map((k, i) => ({ key: k, value: values[i] })));
  if (error) {
    throw new Error(error.message);
  }
};

export const mget = async (keys: string[]): Promise<any[]> => {
  const supabase = client()
  const { data, error } = await supabase.from("kv_store_dfe23da2").select("value").in("key", keys);
  if (error) {
    throw new Error(error.message);
  }
  return data?.map((d) => d.value) ?? [];
};

export const mdel = async (keys: string[]): Promise<void> => {
  const supabase = client()
  const { error } = await supabase.from("kv_store_dfe23da2").delete().in("key", keys);
  if (error) {
    throw new Error(error.message);
  }
};

export const getByPrefix = async (prefix: string): Promise<any[]> => {
  const supabase = client()
  const { data, error } = await supabase.from("kv_store_dfe23da2").select("key, value").like("key", prefix + "%");
  if (error) {
    throw new Error(error.message);
  }
  return data?.map((d) => d.value) ?? [];
};

export const atomicStockDecrement = async (key: string, amount: number, updatedAt: string): Promise<any> => {
  const supabase = client();
  const { data, error } = await supabase.rpc('atomic_stock_decrement', {
    p_key: key,
    p_amount: amount,
    p_updated_at: updatedAt,
  });
  if (error) {
    throw new Error(`atomicStockDecrement(${key}): ${error.message}`);
  }
  return data;
};

export const inserir = async (key: string, value: any): Promise<boolean> => {
  const { error } = await client().from("kv_store_dfe23da2").insert({ key, value });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(error.message);
};
