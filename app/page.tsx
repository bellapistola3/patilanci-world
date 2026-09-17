"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Brush,
  Download,
  Eraser,
  RotateCcw,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import { books, type ColoringBook } from "../lib/books";

const palette = [
  "#ff3b5c",
  "#ff7096",
  "#ff9f43",
  "#ffd43b",
  "#fff176",
  "#7ed957",
  "#2ecc71",
  "#35c7d4",
  "#55b8ff",
  "#3975e8",
  "#7758e8",
  "#b75be8",
  "#ef77c8",
  "#8d5a3b",
  "#c9834c",
  "#f3b68d",
  "#ffd2b3",
  "#b9edf0",
  "#d9c2ff",
  "#b8e7ad",
  "#8b8fa3",
  "#22243a",
  "#ffffff",
  "#f3eee8",
];

type Page = ColoringBook["scenes"][number];

export default function Home() {
  const [activeBook, setActiveBook] = useState<ColoringBook | null>(null);
  const [activePage, setActivePage] = useState<Page | null>(null);
  const [activeBookIndex, setActiveBookIndex] = useState(0);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [color, setColor] = useState(palette[0]);
  const [tool, setTool] = useState<"fill" | "eraser">("fill");
  const [history, setHistory] = useState<ImageData[]>([]);
  const [canvasReady, setCanvasReady] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lineMaskRef = useRef<Uint8Array | null>(null);
  const regionLabelsRef = useRef<Int32Array | null>(null);
  const readyAtRef = useRef(0);
  const loadIdRef = useRef(0);
  const suppressFillUntilRef = useRef(0);

  const loadPage = useCallback((page: Page) => {
    const loadId = ++loadIdRef.current;
    setCanvasReady(false);
    lineMaskRef.current = null;
    regionLabelsRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    const image = new Image();
    image.onload = () => {
      const sourceHeight = Math.min(
        page.cropBottom ?? image.naturalHeight,
        image.naturalHeight,
      );
      canvas.width = image.naturalWidth;
      canvas.height = sourceHeight;
      setCanvasSize({ width: image.naturalWidth, height: sourceHeight });
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        image,
        0,
        0,
        image.naturalWidth,
        sourceHeight,
        0,
        0,
        image.naturalWidth,
        sourceHeight,
      );
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const rawMask = new Uint8Array(canvas.width * canvas.height);
      for (let pixel = 0; pixel < rawMask.length; pixel++) {
        const i = pixel * 4;
        const luminance =
          pixels.data[i] * 0.299 +
          pixels.data[i + 1] * 0.587 +
          pixels.data[i + 2] * 0.114;
        rawMask[pixel] = luminance < 215 ? 1 : 0;
      }
      const closedMask = new Uint8Array(rawMask);
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          if (!rawMask[y * canvas.width + x]) continue;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nextX = x + dx;
              const nextY = y + dy;
              if (
                nextX >= 0 &&
                nextY >= 0 &&
                nextX < canvas.width &&
                nextY < canvas.height
              )
                closedMask[nextY * canvas.width + nextX] = 1;
            }
          }
        }
      }
      lineMaskRef.current = closedMask;
      const labels = new Int32Array(closedMask.length);
      const queue = new Int32Array(closedMask.length);
      let region = 0;
      for (let seed = 0; seed < closedMask.length; seed++) {
        if (closedMask[seed] || labels[seed]) continue;
        region++;
        let head = 0;
        let tail = 0;
        queue[tail++] = seed;
        labels[seed] = region;
        while (head < tail) {
          const pixel = queue[head++];
          const x = pixel % canvas.width;
          const y = Math.floor(pixel / canvas.width);
          if (x + 1 < canvas.width) {
            const next = pixel + 1;
            if (!closedMask[next] && !labels[next]) {
              labels[next] = region;
              queue[tail++] = next;
            }
          }
          if (x > 0) {
            const next = pixel - 1;
            if (!closedMask[next] && !labels[next]) {
              labels[next] = region;
              queue[tail++] = next;
            }
          }
          if (y + 1 < canvas.height) {
            const next = pixel + canvas.width;
            if (!closedMask[next] && !labels[next]) {
              labels[next] = region;
              queue[tail++] = next;
            }
          }
          if (y > 0) {
            const next = pixel - canvas.width;
            if (!closedMask[next] && !labels[next]) {
              labels[next] = region;
              queue[tail++] = next;
            }
          }
        }
      }
      regionLabelsRef.current = labels;
      setHistory([]);
      window.setTimeout(() => {
        if (loadId !== loadIdRef.current) return;
        readyAtRef.current = performance.now();
        setCanvasReady(true);
      }, 650);
    };
    image.src = page.image;
  }, []);

  useEffect(() => {
    if (activePage) loadPage(activePage);
  }, [activePage, loadPage]);

  const selectPage = (book: ColoringBook, page: Page, index: number) => {
    suppressFillUntilRef.current = performance.now() + 1500;
    setActiveBook(book);
    setActiveBookIndex(books.findIndex((item) => item.slug === book.slug));
    setActivePageIndex(index);
    setActivePage(page);
  };

  const hexToRgb = (hex: string) => {
    const value = hex.replace("#", "");
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16),
      255,
    ];
  };

  const fillAt = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (
      !canvasReady ||
      performance.now() < suppressFillUntilRef.current ||
      performance.now() - readyAtRef.current < 150
    )
      return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const lineMask = lineMaskRef.current;
    const labels = regionLabelsRef.current;
    if (!context || !lineMask || !labels) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    let startX = Math.max(
      0,
      Math.min(
        canvas.width - 1,
        Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width),
      ),
    );
    let startY = Math.max(
      0,
      Math.min(
        canvas.height - 1,
        Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height),
      ),
    );
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const before = new ImageData(
      new Uint8ClampedArray(image.data),
      image.width,
      image.height,
    );
    let selectedRegion = labels[startY * canvas.width + startX];
    if (!selectedRegion) {
      const nearestByRegion = new Map<number, number>();
      const snapRadius = Math.min(
        14,
        Math.max(3, Math.ceil((5 * canvas.width) / rect.width)),
      );
      for (let dy = -snapRadius; dy <= snapRadius; dy++) {
        for (let dx = -snapRadius; dx <= snapRadius; dx++) {
          const distance = dx * dx + dy * dy;
          if (distance > snapRadius * snapRadius) continue;
          const x = startX + dx;
          const y = startY + dy;
          if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height)
            continue;
          const candidate = labels[y * canvas.width + x];
          if (!candidate) continue;
          const previous = nearestByRegion.get(candidate);
          if (previous === undefined || distance < previous)
            nearestByRegion.set(candidate, distance);
        }
      }
      if (!nearestByRegion.size) return;
      selectedRegion = [...nearestByRegion.entries()].sort(
        (a, b) => a[1] - b[1],
      )[0][0];
    }

    const replacement =
      tool === "eraser" ? [255, 255, 255, 255] : hexToRgb(color);
    let changed = 0;
    for (let pixel = 0; pixel < labels.length; pixel++) {
      if (labels[pixel] !== selectedRegion) continue;
      const i = pixel * 4;
      image.data[i] = replacement[0];
      image.data[i + 1] = replacement[1];
      image.data[i + 2] = replacement[2];
      image.data[i + 3] = 255;
      changed++;
    }
    if (changed > 0) {
      setHistory((items) => [...items.slice(-14), before]);
      context.putImageData(image, 0, 0);
    }
  };

  const undo = () => {
    const canvas = canvasRef.current;
    const previous = history.at(-1);
    if (!canvas || !previous) return;
    canvas.getContext("2d")?.putImageData(previous, 0, 0);
    setHistory((items) => items.slice(0, -1));
  };

  const reset = () => {
    if (activePage) loadPage(activePage);
  };
  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas || !activePage) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `${activePage.title.toLowerCase().replaceAll(" ", "-")}.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  };
  const movePage = (direction: number) => {
    if (!activeBook) return;
    const next =
      (activePageIndex + direction + activeBook.scenes.length) %
      activeBook.scenes.length;
    setActivePageIndex(next);
    setActivePage(activeBook.scenes[next]);
  };
  const visibleCount = useMemo(
    () => books.reduce((sum, book) => sum + book.scenes.length, 0),
    [],
  );

  return (
    <main className="min-h-screen bg-[#fffaf3] text-[#25194e]">
      <header className="sticky top-0 z-40 border-b border-[#30245b]/10 bg-[#fffaf3]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <a href="#top" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#ffdb4d] to-[#ff765d] text-2xl text-white shadow-lg">
              ✦
            </span>
            <span className="text-xl font-black">
              Патиланци <span className="text-[#ef4f83]">World</span>
            </span>
          </a>
          <nav className="hidden items-center gap-7 font-bold md:flex">
            <a href="#books">Книжки</a>
            <a href="#how">Как работи</a>
            <button onClick={() => setActiveBook(books[0])}>Галерия</button>
          </nav>
          <button
            onClick={() => setActiveBook(books[0])}
            className="rounded-full bg-[#27185d] px-5 py-3 font-black text-white shadow-lg"
          >
            Започни да оцветяваш
          </button>
        </div>
      </header>

      <section
        id="top"
        className="relative overflow-hidden bg-[#27185d] text-white"
      >
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,#ffdb4d_0,transparent_30%),radial-gradient(circle_at_85%_10%,#ef4f83_0,transparent_25%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-[.85fr_1.15fr] lg:px-8 lg:py-24">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 font-bold text-[#ffdf66]">
              <Sparkles size={18} /> Оригинални рисунки за малки творци
            </div>
            <h1 className="text-5xl font-black leading-[.98] tracking-[-.045em] sm:text-7xl">
              Избери рисунка.
              <br />
              <span className="text-[#ff7eb1]">Оцвети своя свят.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#e6e1ff]">
              Две професионални книжки, вдъхновени от най-харесваните kawaii и
              puppy coloring тенденции — с истински отделни страници и работещо
              интерактивно оцветяване.
            </p>
            <a
              href="#books"
              className="mt-8 inline-flex items-center gap-3 rounded-2xl bg-[#ffda4d] px-7 py-4 text-lg font-black text-[#27185d] shadow-xl"
            >
              Разгледай книжките <ArrowRight />
            </a>
          </div>
          <div className="grid grid-cols-2 gap-4 rotate-1">
            {books.map((book, index) => (
              <button
                key={book.slug}
                onClick={() => setActiveBook(book)}
                className={`group relative overflow-hidden rounded-[30px] border-4 border-white bg-white shadow-2xl transition hover:-translate-y-2 ${index === 1 ? "mt-12" : ""}`}
              >
                <img
                  src={book.cover}
                  alt={`Корица на ${book.title}`}
                  className="aspect-square w-full object-cover"
                />
                <span className="absolute inset-x-3 bottom-3 rounded-2xl bg-white/95 p-3 text-left text-[#27185d] shadow-lg">
                  <strong className="block text-base sm:text-lg">
                    {book.title}
                  </strong>
                  <small className="font-bold text-[#ef4f83]">
                    {book.badge}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="books" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <div className="mb-10 text-center">
          <p className="font-black uppercase tracking-[.2em] text-[#ef4f83]">
            Първа колекция
          </p>
          <h2 className="mt-3 text-4xl font-black sm:text-5xl">
            Избери своята книжка
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[#665d82]">
            {visibleCount} отделни рисунки вече са готови за оцветяване. Всяка
            страница се отваря самостоятелно.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          {books.map((book, index) => (
            <article
              key={book.slug}
              className="overflow-hidden rounded-[34px] border border-[#30245b]/10 bg-white shadow-[0_24px_70px_rgba(39,24,93,.12)]"
            >
              <div className="grid sm:grid-cols-[.85fr_1.15fr]">
                <button
                  onClick={() => setActiveBook(book)}
                  className="relative overflow-hidden"
                >
                  <img
                    src={book.cover}
                    alt={book.title}
                    className="h-full min-h-80 w-full object-cover transition duration-500 hover:scale-105"
                  />
                  <span className="absolute left-4 top-4 rounded-full bg-[#27185d] px-4 py-2 text-xs font-black text-white">
                    {book.badge}
                  </span>
                </button>
                <div className="p-7">
                  <p className="font-black text-[#ef4f83]">{book.subtitle}</p>
                  <h3 className="mt-2 text-3xl font-black leading-tight">
                    {book.title}
                  </h3>
                  <p className="mt-4 leading-7 text-[#665d82]">
                    {book.description}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold">
                    <span className="rounded-full bg-[#f2ecff] px-3 py-2">
                      {book.pageCount} страници
                    </span>
                    <span className="rounded-full bg-[#fff0f5] px-3 py-2">
                      {book.age}
                    </span>
                    <span className="rounded-full bg-[#fff8d8] px-3 py-2">
                      30 готови страници
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveBook(book)}
                    className="mt-7 w-full rounded-2xl bg-[#27185d] px-5 py-4 font-black text-white"
                  >
                    Отвори книжката
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="bg-[#f1ebff] py-16">
        <div className="mx-auto grid max-w-5xl gap-5 px-5 md:grid-cols-3">
          {[
            ["1", "Избери книжка"],
            ["2", "Отвори отделна рисунка"],
            ["3", "Оцвети и изтегли"],
          ].map(([n, t]) => (
            <div
              key={n}
              className="rounded-3xl bg-white p-6 text-center shadow-sm"
            >
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#ffda4d] text-xl font-black">
                {n}
              </span>
              <h3 className="mt-4 text-xl font-black">{t}</h3>
            </div>
          ))}
        </div>
      </section>
      <footer className="bg-[#27185d] px-5 py-10 text-center text-[#ddd6ff]">
        © 2026 Патиланци World • Оригинални детски книжки за оцветяване
      </footer>

      {activeBook && !activePage && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#160d38]/95 p-4 backdrop-blur-xl">
          <div className="mx-auto my-3 max-w-6xl overflow-hidden rounded-[32px] bg-[#fffaf3] text-[#25194e] shadow-2xl">
            <div className="grid md:grid-cols-[300px_1fr]">
              <aside className="bg-[#f1ebff] p-6">
                <img
                  src={activeBook.cover}
                  alt={activeBook.title}
                  className="aspect-square w-full rounded-3xl object-cover shadow-xl"
                />
                <p className="mt-5 font-black text-[#ef4f83]">
                  {activeBook.badge}
                </p>
                <h2 className="mt-2 text-3xl font-black leading-tight">
                  {activeBook.title}
                </h2>
                <p className="mt-3 text-[#665d82]">{activeBook.description}</p>
                <button
                  onClick={() => setActiveBook(null)}
                  className="mt-6 flex items-center gap-2 font-black"
                >
                  <ArrowLeft size={18} /> Назад към сайта
                </button>
              </aside>
              <div className="p-5 sm:p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[#ef4f83]">
                      30 отделни страници
                    </p>
                    <h3 className="text-3xl font-black">
                      {activeBook.slug === "lia-star-crown"
                        ? "Историята започва тук"
                        : "Избери за оцветяване"}
                    </h3>
                  </div>
                  <button
                    onClick={() => setActiveBook(null)}
                    aria-label="Затвори"
                    className="grid h-11 w-11 place-items-center rounded-full bg-[#eee8f7]"
                  >
                    <X />
                  </button>
                </div>
                <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {activeBook.scenes.map((page, index) => (
                    <button
                      key={page.title}
                      onClick={() => selectPage(activeBook, page, index)}
                      className="group overflow-hidden rounded-2xl border-2 border-[#e6dff1] bg-white text-left transition hover:-translate-y-1 hover:border-[#ef4f83] hover:shadow-xl"
                    >
                      <div className="aspect-[4/5] w-full overflow-hidden bg-white">
                        <img
                          src={page.image}
                          alt={page.title}
                          className={`w-full bg-white ${page.cropBottom ? "h-auto object-top" : "h-full object-contain"}`}
                        />
                      </div>
                      <div className="p-4">
                        <span className="text-xs font-black text-[#ef4f83]">
                          СТРАНИЦА {index + 1} ОТ 30
                        </span>
                        <h4 className="mt-1 font-black">{page.title}</h4>
                        {page.story && (
                          <p className="mt-2 line-clamp-3 text-sm leading-5 text-[#6f6688]">
                            {page.story}
                          </p>
                        )}
                        <span className="mt-3 inline-block text-sm font-bold">
                          Оцвети сега →
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activePage && activeBook && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#11092d] text-white">
          <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#1d1244]/95 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setActivePage(null);
                  setHistory([]);
                }}
                className="tool"
                aria-label="Назад към страниците"
              >
                <ArrowLeft />
              </button>
              <div>
                <p className="text-xs font-bold text-[#ff9bc0]">
                  {activeBook.title} • {activePageIndex + 1}/30
                </p>
                <h2 className="font-black">{activePage.title}</h2>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={undo} className="tool" aria-label="Върни назад">
                <Undo2 />
              </button>
              <button onClick={reset} className="tool" aria-label="Изчисти">
                <RotateCcw />
              </button>
              <button
                onClick={download}
                className="tool px-4"
                aria-label="Изтегли"
              >
                <Download />
                <span className="hidden sm:inline">Изтегли</span>
              </button>
              <button
                onClick={() => {
                  setActivePage(null);
                  setActiveBook(null);
                }}
                className="tool"
                aria-label="Затвори"
              >
                <X />
              </button>
            </div>
          </header>
          {activePage.story && (
            <div className="border-b border-white/10 bg-[#2b1c61] px-5 py-4 text-center text-base font-semibold leading-7 text-[#f4efff]">
              <span className="mr-2 font-black text-[#ffcf58]">
                Част {activePageIndex + 1}:
              </span>
              {activePage.story}
            </div>
          )}
          <div className="grid min-h-[calc(100vh-72px)] lg:grid-cols-[105px_1fr_240px]">
            <aside className="flex justify-center gap-3 border-b border-white/10 p-4 lg:flex-col lg:justify-start lg:border-b-0 lg:border-r">
              <button
                onClick={() => setTool("fill")}
                className={`tool ${tool === "fill" ? "active" : ""}`}
              >
                <Brush />
                <span>Цвят</span>
              </button>
              <button
                onClick={() => setTool("eraser")}
                className={`tool ${tool === "eraser" ? "active" : ""}`}
              >
                <Eraser />
                <span>Гума</span>
              </button>
            </aside>
            <section className="grid place-items-center bg-[#dcd8ec] p-2 sm:p-3">
              <div className="relative flex w-full max-w-[min(100%,calc(100vh-150px))] items-center justify-center overflow-hidden rounded-2xl bg-white p-1 shadow-2xl">
                <canvas
                  ref={canvasRef}
                  onPointerDown={fillAt}
                  data-ready={canvasReady}
                  data-selected-color={color}
                  className={`h-auto w-full max-h-[calc(100vh-158px)] max-w-[calc(100vh-158px)] touch-none object-contain ${canvasReady ? "cursor-crosshair" : "cursor-wait opacity-70"}`}
                  style={{
                    aspectRatio: `${canvasSize.width} / ${canvasSize.height}`,
                  }}
                  aria-label={`Оцветяване: ${activePage.title}`}
                />
                {!canvasReady && (
                  <div className="pointer-events-none absolute inset-0 grid place-items-center bg-white/65 font-black text-[#27185d]">
                    Подготвям рисунката…
                  </div>
                )}
              </div>
            </section>
            <aside className="border-t border-white/10 p-5 lg:border-l lg:border-t-0">
              <h3 className="font-black">Избери цвят</h3>
              <div className="mt-4 grid grid-cols-5 gap-3 lg:grid-cols-4">
                {palette.map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      setColor(item);
                      setTool("fill");
                    }}
                    aria-label={`Цвят ${item}`}
                    className={`aspect-square rounded-full border-4 transition ${color === item && tool === "fill" ? "scale-110 border-white" : "border-white/15"}`}
                    style={{ background: item }}
                  />
                ))}
              </div>
              <div className="mt-8 rounded-2xl bg-white/10 p-4 text-sm leading-6 text-[#ded7ff]">
                Избери цвят и натисни в затворено бяло поле. Използвай гумата,
                за да върнеш отделна област в бяло.
              </div>
              <div className="mt-6 flex gap-2">
                <button onClick={() => movePage(-1)} className="tool flex-1">
                  <ArrowLeft /> Предишна
                </button>
                <button onClick={() => movePage(1)} className="tool flex-1">
                  Следваща <ArrowRight />
                </button>
              </div>
            </aside>
          </div>
        </div>
      )}
    </main>
  );
}
