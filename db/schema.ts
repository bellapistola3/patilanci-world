import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const books = sqliteTable("books", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  coverAsset: text("cover_asset"),
  theme: text("theme").notNull(),
  ageMin: integer("age_min").notNull(),
  ageMax: integer("age_max").notNull(),
  priceCents: integer("price_cents").notNull().default(999),
  currency: text("currency").notNull().default("EUR"),
  isFree: integer("is_free", { mode: "boolean" }).notNull().default(false),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_books_published_sort").on(table.isPublished, table.sortOrder)]);

export const coloringPages = sqliteTable("coloring_pages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookId: integer("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  svgAsset: text("svg_asset"),
  previewAsset: text("preview_asset"),
  printableAsset: text("printable_asset"),
  isPreview: integer("is_preview", { mode: "boolean" }).notNull().default(false),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("uq_coloring_pages_book_slug").on(table.bookId, table.slug), index("idx_coloring_pages_book_sort").on(table.bookId, table.sortOrder)]);

export const artworkProgress = sqliteTable("artwork_progress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  pageId: integer("page_id").notNull().references(() => coloringPages.id, { onDelete: "cascade" }),
  drawingData: text("drawing_data").notNull(),
  completionPercent: integer("completion_percent").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("uq_artwork_progress_user_page").on(table.userId, table.pageId), index("idx_artwork_progress_user").on(table.userId)]);
