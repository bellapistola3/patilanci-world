import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { books, coloringPages } from "../../../db/schema";

export async function GET() {
  try {
    const db = getDb();
    const bookRows = await db.select().from(books).where(eq(books.isPublished, true)).orderBy(asc(books.sortOrder));
    const pageRows = await db.select().from(coloringPages).where(eq(coloringPages.isPublished, true)).orderBy(asc(coloringPages.sortOrder));
    return Response.json({ books: bookRows.map((book) => ({ ...book, pages: pageRows.filter((page) => page.bookId === book.id) })) });
  } catch {
    return Response.json({ error: "Библиотеката временно не е достъпна." }, { status: 503 });
  }
}
