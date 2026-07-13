import { MODULES } from "@/lib/dashboardModules";

export interface TourStep {
  path: string;
  /** Selector CSS, o función que lo resuelve según el rol (para pasos con anchor distinto por rol). */
  selector: string | ((role: string | undefined) => string);
  title: string;
  description: string;
  /** Si se omite, el paso aplica a cualquier rol. */
  roles?: string[];
}

const PHASE_A_INTRO: TourStep = {
  path: "/dashboard",
  selector: '[data-tour="dashboard-search"]',
  title: "Buscador",
  description: "Buscá cualquier módulo por nombre desde acá.",
};

// Fase A: un paso por cada tile visible del dashboard, derivado de MODULES
// para no desincronizarse si se agregan/quitan módulos.
const PHASE_A_TILES: TourStep[] = MODULES.map((m) => ({
  path: "/dashboard",
  selector: `[data-tour="${m.tourId}"]`,
  title: m.name,
  description: m.tourDescription,
  roles: m.roles,
}));

const PHASE_B: TourStep[] = [
  {
    path: "/customers",
    selector: '[data-tour="customers-new"]',
    title: "Nuevo cliente",
    description: "Cargá un cliente nuevo desde acá — después vas a poder asignarle presupuestos.",
  },
  {
    path: "/products",
    selector: (role) =>
      role === "ADMIN" ? '[data-tour="products-new"]' : '[data-tour="products-price"]',
    title: "Catálogo",
    description:
      "Acá podés cargar una lámina nueva al catálogo, con su costo y precio de venta sugerido.",
    roles: ["ADMIN"],
  },
  {
    path: "/products",
    selector: (role) =>
      role === "ADMIN" ? '[data-tour="products-new"]' : '[data-tour="products-price"]',
    title: "Tu precio de venta",
    description:
      "Este es el precio de venta que vas a usar al armar presupuestos — el admin puede haberlo personalizado para vos.",
    roles: ["OPERATOR"],
  },
  {
    path: "/orders",
    selector: '[data-tour="orders-new"]',
    title: "Nueva venta",
    description: "Armá un presupuesto nuevo: elegís vidrios, lámina y el sistema calcula el plan de cortes.",
  },
  {
    path: "/admin",
    selector: '[data-tour="admin-pricelists-link"]',
    title: "Listas de precios",
    description: "Asignále a cada operador un costo y/o precio de venta personalizado por producto.",
    roles: ["ADMIN"],
  },
  {
    path: "/admin",
    selector: '[data-tour="admin-users-link"]',
    title: "Usuarios",
    description: "Gestioná altas, bajas y roles del equipo.",
    roles: ["ADMIN"],
  },
  {
    path: "/settings",
    selector: '[data-tour="settings-tabs"]',
    title: "Configuración",
    description: "Tu perfil, los datos de tu empresa y la conexión con Gmail para enviar presupuestos.",
  },
];

const PHASE_C_OUTRO: TourStep = {
  path: "/dashboard",
  selector: '[data-tour="user-menu"]',
  title: "¡Listo!",
  description: "Ya conocés lo esencial. Repetí este recorrido cuando quieras desde el menú de usuario.",
};

const ALL_STEPS: TourStep[] = [PHASE_A_INTRO, ...PHASE_A_TILES, ...PHASE_B, PHASE_C_OUTRO];

export function getTourSteps(role: string | undefined): TourStep[] {
  return ALL_STEPS.filter((s) => !s.roles || (role != null && s.roles.includes(role)));
}

export function resolveStepSelector(step: TourStep, role: string | undefined): string {
  return typeof step.selector === "function" ? step.selector(role) : step.selector;
}
