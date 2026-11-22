import type { RequestHandler } from "express";
import type { Filter, Sort } from "mongodb";
import { cs_servicesCollection, cs_usersCollection } from "../config/cs_db";
import type { Cs_Service, Cs_ServiceCategory, Cs_ServiceMode } from "../cs_types";
import { Cs_AppError } from "../utils/cs_appError";
import {
  CS_CATEGORIES,
  CS_FEATURED_LIMIT,
  CS_PAGE_LIMIT_DEFAULT,
  CS_PAGE_LIMIT_MAX,
  CS_PUBLIC_SERVICE_FILTER,
  CS_SERVICE_MODES,
} from "../utils/cs_constants";
import { cs_escapeRegex, cs_queryInt, cs_queryString, cs_toObjectId } from "../utils/cs_query";

const CS_SORTS: Record<string, Sort> = {
  price_asc: { basePrice: 1, _id: 1 },
  price_desc: { basePrice: -1, _id: 1 },
  newest: { createdAt: -1, _id: -1 },
};

// Owner email stays private on public routes
const CS_PUBLIC_PROJECTION = { technicianEmail: 0 } as const;

// GET /api/services?search=&category=&mode=&sort=&page=&limit=
export const cs_getServices: RequestHandler = async (req, res) => {
  const cs_search = cs_queryString(req.query.search).slice(0, 100);
  const cs_category = cs_queryString(req.query.category);
  const cs_mode = cs_queryString(req.query.mode);
  const cs_sortKey = cs_queryString(req.query.sort);
  const cs_limit = cs_queryInt(req.query.limit, CS_PAGE_LIMIT_DEFAULT, CS_PAGE_LIMIT_MAX);
  const cs_requestedPage = cs_queryInt(req.query.page, 1);

  const cs_filter: Filter<Cs_Service> = { ...CS_PUBLIC_SERVICE_FILTER };
  if (cs_search) {
    const cs_regex = { $regex: cs_escapeRegex(cs_search), $options: "i" };
    cs_filter.$or = [{ title: cs_regex }, { category: cs_regex }];
  }
  if (CS_CATEGORIES.includes(cs_category as Cs_ServiceCategory)) {
    cs_filter.category = cs_category as Cs_ServiceCategory;
  }
  if (CS_SERVICE_MODES.includes(cs_mode as Cs_ServiceMode)) {
    cs_filter.serviceMode = cs_mode as Cs_ServiceMode;
  }

  const cs_services = await cs_servicesCollection();
  const cs_total = await cs_services.countDocuments(cs_filter);
  const cs_pages = Math.max(1, Math.ceil(cs_total / cs_limit));
  const cs_page = Math.min(cs_requestedPage, cs_pages);

  const cs_items = await cs_services
    .find(cs_filter, { projection: CS_PUBLIC_PROJECTION })
    .sort(CS_SORTS[cs_sortKey] ?? CS_SORTS.newest)
    .skip((cs_page - 1) * cs_limit)
    .limit(cs_limit)
    .toArray();

  res.json({ success: true, items: cs_items, total: cs_total, page: cs_page, pages: cs_pages, limit: cs_limit });
};

// GET /api/services/featured
export const cs_getFeaturedServices: RequestHandler = async (_req, res) => {
  const cs_items = await (await cs_servicesCollection())
    .find(CS_PUBLIC_SERVICE_FILTER, { projection: CS_PUBLIC_PROJECTION })
    .sort({ createdAt: -1, _id: -1 })
    .limit(CS_FEATURED_LIMIT)
    .toArray();

  res.json({ success: true, items: cs_items });
};

// GET /api/services/:id with technician summary
export const cs_getServiceById: RequestHandler = async (req, res) => {
  const cs_serviceId = cs_toObjectId(req.params.id, "Service not found");

  const cs_service = await (await cs_servicesCollection()).findOne({ _id: cs_serviceId, ...CS_PUBLIC_SERVICE_FILTER });
  if (!cs_service) throw new Cs_AppError(404, "Service not found");

  const cs_technician = await (await cs_usersCollection()).findOne(
    { email: cs_service.technicianEmail },
    { projection: { _id: 0, name: 1, image: 1, area: 1, bio: 1 } },
  );

  const { technicianEmail: _cs_hidden, ...cs_publicService } = cs_service;
  res.json({
    success: true,
    service: cs_publicService,
    technician: cs_technician ?? { name: cs_service.technicianName },
  });
};
