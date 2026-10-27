const w = window as any;
export async function getAllOrders() { return { success: true, orders: w.__pedidos || [] }; }
export async function getDeliveryDrivers() { return { success: true, drivers: w.__motoboys || [] }; }
export async function adminFetch() { return { ok: true, json: async () => ({ success: true, orders: w.__historico || [] }) }; }
export async function getDriverLocations() { return { success: true, locations: [] }; }
