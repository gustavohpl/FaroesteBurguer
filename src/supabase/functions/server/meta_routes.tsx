import { Hono } from "npm:hono";
import * as kv from "./kv_retry.tsx";

export function setupMetaRoutes(app: Hono) {
  const PREFIX = "/make-server-dfe23da2/meta";

  app.get(`${PREFIX}/status`, async (c) => {
    const hasToken = !!Deno.env.get('META_ACCESS_TOKEN');
    const hasPixel = !!Deno.env.get('META_PIXEL_ID');
    
    return c.json({
      success: true,
      configured: hasToken && hasPixel,
      pixelId: Deno.env.get('META_PIXEL_ID') || null
    });
  });

  app.post(`${PREFIX}/sync`, async (c) => {
    try {
      
      const storedCampaigns = await kv.getByPrefix('ad_campaign:');
      
      const mockIds = ['camp_123', 'camp_456'];
      const realCampaigns = [];
      
      for (const camp of storedCampaigns) {
        if (mockIds.includes(camp.id)) {
          await kv.del(`ad_campaign:${camp.id}`);
        } else {
          realCampaigns.push(camp);
        }
      }

      const metrics = [];

      return c.json({ 
        success: true, 
        campaigns: realCampaigns,
        metrics: metrics,
        synced: true
      });
    } catch (error) {
      console.error("Meta Sync Error:", error);
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  app.post(`${PREFIX}/campaigns`, async (c) => {
    try {
      const data = await c.req.json();
      
      const newCampaign = {
        id: `camp_${Date.now()}`,
        ...data,
        status: 'PAUSED',
        spend: 0,
        impressions: 0,
        clicks: 0,
        purchases: 0,
        revenue: 0,
        createdAt: new Date().toISOString()
      };

      await kv.set(`ad_campaign:${newCampaign.id}`, newCampaign);

      return c.json({ success: true, campaign: newCampaign });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  app.put(`${PREFIX}/campaigns/:id`, async (c) => {
    try {
      const id = c.req.param('id');
      const updates = await c.req.json();
      
      const campaign = await kv.get(`ad_campaign:${id}`);
      if (!campaign) {
        return c.json({ success: false, error: "Campaign not found" }, 404);
      }

      const updatedCampaign = { ...campaign, ...updates };
      await kv.set(`ad_campaign:${id}`, updatedCampaign);

      return c.json({ success: true, campaign: updatedCampaign });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  app.post(`${PREFIX}/conversions`, async (c) => {
    try {
      const eventData = await c.req.json();
      
      const eventId = `pixel_event:${Date.now()}`;
      await kv.set(eventId, {
        ...eventData,
        timestamp: new Date().toISOString(),
        syncedToMeta: false
      });

      
      return c.json({ success: true, eventId });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });
  
  app.post(`${PREFIX}/audiences`, async (c) => {
    try {
        const data = await c.req.json();
        const id = `aud_${Date.now()}`;
        const audience = { id, ...data, size: Math.floor(Math.random() * 5000) + 100 };
        return c.json({ success: true, audience });
    } catch (error) {
        return c.json({ success: false, error: String(error) }, 500);
    }
  });
}
