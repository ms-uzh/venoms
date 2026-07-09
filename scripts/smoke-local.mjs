const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:8787";
const checks = [
  { path: "/", status: 200, includes: "venoMS" },
  { path: "/alkaloids", status: 200, includes: "Acylpolyamines" },
  { path: "/small-compounds", status: 200, includes: "Small compounds" },
  { path: "/structure-elucidation", status: 200, includes: "Analytical tools" },
  { path: "/contact", status: 200, includes: "Contact us" },
  { path: "/alkaloids/prop/prop3334gu", status: 200, includes: "Prop3334Gu" },
  { path: "/small-compounds/biogenic-amines/serotonin", status: 200, includes: "Serotonin" },
  { path: "/structure-elucidation/fragmentation-rules", status: 200, includes: "Fragmentation" },
  { path: "/search?q=serotonin", status: 200, includes: "Serotonin" },
  { path: "/search?q=C17H39N7O", status: 200, includes: "Prop3334Gu" },
  { path: "/search?q=Fragmentation", status: 200, includes: "Fragmentation rules for acylpolyamines" },
  { path: "/search?family=Agelenidae", status: 200, includes: "Agelenidae" },
  { path: "/search?species=Eratigena%20agrestis", status: 200, includes: "Eratigena agrestis" },
  { path: "/search?formula=C17H39N7O", status: 200, includes: "Prop3334Gu" },
  { path: "/search?level=S-3", status: 200, includes: "S-3" },
  { path: "/search?confidence=C-1", status: 200, includes: "C-1" },
  { path: "/search?mz=481.31&tol=0.02", status: 200, includes: "PhAcAsn3(Me)43" },
  { path: "/calc", status: 200, includes: "Polyamine units" },
  { path: "/img_MSMS/177_Serotonin.png", status: 200, contentType: "image/" },
  { path: "/pdf/177_Serotonin_4-31.pdf", status: 200, contentType: "application/pdf" },
  { path: "/calc/", status: 301, location: "/calc" },
  { path: "/alkaloids/not-a-real-subclass", status: 404 },
  { path: "/small-compounds/not-a-real-subclass", status: 404 },
  { path: "/categories/2-4-oh2-phacasn34", status: 301, location: "/search?term=2-4-OH2-PhAcAsn34" },
  { path: "/categories/2-4-oh2-phacasn34/page/1", status: 301, location: "/search?term=2-4-OH2-PhAcAsn34" },
];

for (const check of checks) {
  await assertGet(check);
}

await assertPostCalc();
await assertLegacySearch();

console.log(`Smoke checks passed against ${baseUrl}`);

async function assertGet(check) {
  const response = await fetch(`${baseUrl}${check.path}`, { redirect: "manual" });
  assert(response.status === check.status, `${check.path} returned ${response.status}, expected ${check.status}`);

  if (check.location) {
    const location = response.headers.get("location") || "";
    assert(location.endsWith(check.location), `${check.path} redirected to ${location}, expected ${check.location}`);
  }

  if (check.contentType) {
    const contentType = response.headers.get("content-type") || "";
    assert(contentType.startsWith(check.contentType), `${check.path} content-type ${contentType}, expected ${check.contentType}`);
  }

  if (check.includes) {
    const text = await response.text();
    assert(text.includes(check.includes), `${check.path} did not include ${check.includes}`);
  }
}

async function assertPostCalc() {
  const params = new URLSearchParams({
    head: "Prop",
    polyamine1: "3",
    polyamine2: "3",
    polyamine3: "3",
    polyamine4: "4",
    tail: "Gu",
  });
  for (let index = 5; index <= 10; index++) {
    params.set(`polyamine${index}`, "-");
  }
  params.set("spider1", "-");
  params.set("spider2", "-");
  params.set("spider3", "-");

  const response = await fetch(`${baseUrl}/calc`, {
    method: "POST",
    body: params,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  const text = await response.text();
  assert(response.status === 200, `/calc POST returned ${response.status}`);
  assert(text.includes("Prop3334Gu"), "/calc POST did not include Prop3334Gu");
  assert((response.headers.get("cache-control") || "").includes("no-store"), "/calc POST is missing no-store cache header");
}

async function assertLegacySearch() {
  const response = await fetch(`${baseUrl}/categories/2-4-oh2-phacasn34`);
  const text = await response.text();
  assert(response.status === 200, `legacy taxonomy redirect returned ${response.status}`);
  assert(text.includes("2,4-(OH)₂-PhAcAsn34"), "legacy taxonomy search did not include the matching compound");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
