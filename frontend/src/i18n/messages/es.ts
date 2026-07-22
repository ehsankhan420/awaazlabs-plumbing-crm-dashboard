/**
 * Spanish message catalogue. Typed as `Record<MessageKey, string>` against `en.ts`, so a
 * missing translation is a compile error, not a runtime fallback.
 */

import type { Messages } from './en';

export const es: Messages = {
  // --- Navigation groups ---
  'nav.group.home': 'INICIO',
  'nav.group.operations': 'OPERACIONES',
  'nav.group.agents': 'AGENTES',
  'nav.group.quality': 'CALIDAD',
  'nav.group.growth': 'CRECIMIENTO',
  'nav.group.insights': 'ANÁLISIS',
  'nav.group.compliance': 'CUMPLIMIENTO',
  'nav.group.settings': 'CONFIGURACIÓN',

  // --- Navigation items ---
  'nav.overview': 'Resumen',
  'nav.jobs': 'Trabajos',
  'nav.conversations': 'Conversaciones',
  'nav.calls': 'Llamadas',
  'nav.chats': 'Chats',
  'nav.escalations': 'Escalamientos',
  'nav.dispatchQueue': 'Cola de despacho',
  'nav.receptionist': 'Recepcionista IA',
  'nav.dispatchAgent': 'Agente de despacho',
  'nav.chatAgents': 'Agentes de chat',
  'nav.reviewTaker': 'Solicitud de reseñas',
  'nav.reengagement': 'Reactivación',
  'nav.quality': 'Calidad y optimización',
  'nav.knowledge': 'Conocimiento del agente',
  'nav.reviews': 'Reseñas',
  'nav.campaigns': 'Campañas',
  'nav.reports': 'Informes y exportaciones',
  'nav.auditLog': 'Registro de auditoría',
  'nav.members': 'Miembros',
  'nav.billing': 'Uso y facturación',
  'nav.organization': 'Organización y ubicaciones',
  'nav.lines': 'Líneas y números',
  'nav.consent': 'Consentimiento y no llamar',
  'nav.notifications': 'Notificaciones',

  // --- Shell chrome ---
  'shell.skipToContent': 'Saltar al contenido principal',
  'shell.mainNavigation': 'Navegación principal',
  'shell.expandNavigation': 'Expandir navegación',
  'shell.collapseNavigation': 'Contraer navegación',

  // --- Top bar ---
  'topbar.organization': 'Organización',
  'topbar.changeOrganization': 'Cambiar de organización',
  'topbar.allLocations': 'Todas las ubicaciones',
  'topbar.changeLocation': 'Cambiar ubicación',
  'topbar.locationFilter': 'Filtro de ubicación',
  'topbar.notifications': 'Notificaciones',
  'topbar.unread': 'sin leer',
  'topbar.notificationsNone': 'Notificaciones: ninguna sin leer',
  'topbar.notificationsEscalations': 'Escalamientos por reconocer o resolver',
  'topbar.notificationsDispatch': 'Registros de despacho que requieren atención',
  'topbar.userMenu': 'Menú de usuario',
  'topbar.signedInAs': 'Sesión iniciada como',
  'topbar.demoControls': 'Controles de demostración',
  'topbar.demoControlsNote':
    'No es una función del producto. En una implementación real, el rol y la organización llegan con la sesión autenticada y nunca son autoservicio.',
  'topbar.role': 'Rol',
  'topbar.interfaceLanguage': 'Idioma de la interfaz',
  'topbar.interfaceLanguageNote':
    'El marco de i18n está en su lugar. El chrome de la aplicación está traducido; el contenido de las páginas se entrega en inglés, con español como segundo objetivo.',

  // --- Under construction placeholder ---
  'underConstruction.badge': 'En construcción',
  'underConstruction.spec': 'Especificación:',
  'underConstruction.plannedFor': 'Planificado para:',
  'underConstruction.milestone2': 'Hito 2',

  // --- Route guard ---
  'guard.notAvailable': 'no está disponible',
  'guard.explanation':
    'Su rol no otorga acceso a esta superficie. Si cree que esto es un error, contacte al propietario de su organización.',
};
