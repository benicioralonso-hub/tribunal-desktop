/**
 * Filtros de lista + categoryRoot.
 */
import assert from "node:assert/strict";
import { categoryRootFromFolderPath } from "../category-root";
import {
  filterMappedCases,
  uniqueCategoryRoots,
  uniqueCompetitions,
} from "../filter-cases";
import type { MappedCase } from "../types";

assert.equal(
  categoryRootFromFolderPath(
    "/boletin/0001 PRIMERA LPF/River Plate c. Boca Juniors 99.523",
  ),
  "0001 PRIMERA LPF",
);
assert.equal(
  categoryRootFromFolderPath("/boletin/0002/Local - Visitante 1"),
  "0002",
);

function fake(partial: Partial<MappedCase> & { id: string }): MappedCase {
  return {
    folderPath: "/x",
    folderName: "A c. B 1",
    casoPdfPath: null,
    informePdfPath: null,
    expediente: null,
    homeClub: null,
    awayClub: null,
    person: null,
    club: null,
    role: null,
    matchDate: null,
    competition: null,
    tipoEvento: null,
    categoryRoot: null,
    confidence: 0,
    engine: "classical",
    warning: null,
    draft: null,
    included: true,
    informeIncluded: true,
    attachments: [],
    ...partial,
  };
}

const cases: MappedCase[] = [
  fake({
    id: "1",
    person: "Juan Pérez",
    club: "River Plate",
    expediente: "99.523",
    categoryRoot: "0001 PRIMERA LPF",
    competition: "Torneo Preview",
  }),
  fake({
    id: "2",
    person: "Camila Bianchini",
    club: "Centro Asturiano",
    categoryRoot: "0001 PRIMERA LPF",
    competition: "Futsal Femenino Preview",
  }),
  fake({
    id: "3",
    person: "Pedro Gómez",
    club: "San Lorenzo",
    categoryRoot: "0002 RESERVA",
    competition: "Torneo Preview",
  }),
];

assert.deepEqual(uniqueCategoryRoots(cases), [
  "0001 PRIMERA LPF",
  "0002 RESERVA",
]);
assert.deepEqual(uniqueCompetitions(cases), [
  "Futsal Femenino Preview",
  "Torneo Preview",
]);

const byCat = filterMappedCases(cases, {
  categoryRoot: "0002 RESERVA",
  competition: "",
  query: "",
});
assert.equal(byCat.length, 1);
assert.equal(byCat[0]!.id, "3");

const byComp = filterMappedCases(cases, {
  categoryRoot: "",
  competition: "Futsal Femenino Preview",
  query: "",
});
assert.equal(byComp.length, 1);
assert.equal(byComp[0]!.person, "Camila Bianchini");

const byQuery = filterMappedCases(cases, {
  categoryRoot: "",
  competition: "",
  query: "99.523",
});
assert.equal(byQuery.length, 1);
assert.equal(byQuery[0]!.person, "Juan Pérez");

const byName = filterMappedCases(cases, {
  categoryRoot: "0001 PRIMERA LPF",
  competition: "",
  query: "asturiano",
});
assert.equal(byName.length, 1);

console.log("OK — filter-cases + category-root");
