import "dotenv/config";

import { prisma } from "../src/lib/prisma";

const treatments = [
    {
        name: "Consultație",
        slug: "consultatie",
        description:
            "Evaluarea generală a sănătății orale și stabilirea pașilor următori de tratament.",
    },
    {
        name: "Igienizare",
        slug: "igienizare",
        description:
            "Detartraj, periaj profesional și alte proceduri pentru îndepărtarea plăcii și tartrului.",
    },
    {
        name: "Carii și obturații",
        slug: "carii-si-obturatii",
        description:
            "Evaluarea și tratarea cariilor dentare prin restaurări și obturații.",
    },
    {
        name: "Tratament de canal",
        slug: "tratament-de-canal",
        description:
            "Proceduri endodontice pentru tratarea infecțiilor sau inflamațiilor din interiorul dintelui.",
    },
    {
        name: "Afecțiuni gingivale",
        slug: "afectiuni-gingivale",
        description:
            "Evaluarea și tratamentul problemelor gingivale și parodontale.",
    },
    {
        name: "Protetică dentară",
        slug: "protetica-dentara",
        description:
            "Consultații și tratamente pentru coroane, punți, proteze și alte restaurări protetice.",
    },
    {
        name: "Stomatologie pediatrică",
        slug: "stomatologie-pediatrica",
        description:
            "Consultații și tratamente stomatologice adaptate copiilor și adolescenților.",
    },
    {
        name: "Chirurgie dento-alveolară",
        slug: "chirurgie-dento-alveolara",
        description:
            "Evaluarea și realizarea procedurilor chirurgicale dentare, inclusiv extracții.",
    },
    {
        name: "Ortodonție",
        slug: "ortodontie",
        description:
            "Evaluarea alinierii dinților și a mușcăturii, precum și monitorizarea tratamentelor ortodontice.",
    },
] as const;

const cities = [
  {
    name: "Arad",
    slug: "arad",
  },
  {
    name: "București",
    slug: "bucuresti",
  },
  {
    name: "Cluj-Napoca",
    slug: "cluj-napoca",
  },
  {
    name: "Constanța",
    slug: "constanta",
  },
  {
    name: "Craiova",
    slug: "craiova",
  },
  {
    name: "Galați",
    slug: "galati",
  },
  {
    name: "Iași",
    slug: "iasi",
  },
  {
    name: "Oradea",
    slug: "oradea",
  },
  {
    name: "Sibiu",
    slug: "sibiu",
  },
  {
    name: "Târgu Mureș",
    slug: "targu-mures",
  },
  {
    name: "Timișoara",
    slug: "timisoara",
  },
] as const;

const universities = [
  {
    slug: "umf-carol-davila-bucuresti",
    shortName: "UMF Carol Davila București",
    fullName: "Universitatea de Medicină și Farmacie „Carol Davila” din București",
    city: "București",
  },
  {
    slug: "umf-iuliu-hatieganu-cluj-napoca",
    shortName: "UMF Cluj-Napoca",
    fullName: "Universitatea de Medicină și Farmacie „Iuliu Hațieganu” din Cluj-Napoca",
    city: "Cluj-Napoca",
  },
  {
    slug: "universitatea-ovidius-constanta",
    shortName: "Universitatea Ovidius Constanța",
    fullName: "Universitatea „Ovidius” din Constanța",
    city: "Constanța",
  },
  {
    slug: "umf-craiova",
    shortName: "UMF Craiova",
    fullName: "Universitatea de Medicină și Farmacie din Craiova",
    city: "Craiova",
  },
  {
    slug: "universitatea-dunarea-de-jos-galati",
    shortName: "Universitatea Dunărea de Jos Galați",
    fullName: "Universitatea „Dunărea de Jos” din Galați",
    city: "Galați",
  },
  {
    slug: "umf-grigore-t-popa-iasi",
    shortName: "UMF Grigore T. Popa Iași",
    fullName: "Universitatea de Medicină și Farmacie „Grigore T. Popa” din Iași",
    city: "Iași",
  },
  {
    slug: "universitatea-din-oradea",
    shortName: "Universitatea din Oradea",
    fullName: "Universitatea din Oradea",
    city: "Oradea",
  },
  {
    slug: "universitatea-lucian-blaga-sibiu",
    shortName: "Universitatea Lucian Blaga Sibiu",
    fullName: "Universitatea „Lucian Blaga” din Sibiu",
    city: "Sibiu",
  },
  {
    slug: "umfst-george-emil-palade-targu-mures",
    shortName: "UMFST George Emil Palade Târgu Mureș",
    fullName: "Universitatea de Medicină, Farmacie, Științe și Tehnologie „George Emil Palade” din Târgu Mureș",
    city: "Târgu Mureș",
  },
  {
    slug: "umf-victor-babes-timisoara",
    shortName: "UMF Victor Babeș Timișoara",
    fullName: "Universitatea de Medicină și Farmacie „Victor Babeș” din Timișoara",
    city: "Timișoara",
  },
  {
    slug: "universitatea-titu-maiorescu-bucuresti",
    shortName: "Universitatea Titu Maiorescu București",
    fullName: "Universitatea „Titu Maiorescu” din București",
    city: "București",
  },
  {
    slug: "universitatea-de-vest-vasile-goldis-arad",
    shortName: "Universitatea de Vest Vasile Goldiș Arad",
    fullName: "Universitatea de Vest „Vasile Goldiș” din Arad",
    city: "Arad",
  },
  {
    slug: "universitatea-apollonia-iasi",
    shortName: "Universitatea Apollonia Iași",
    fullName: "Universitatea „Apollonia” din Iași",
    city: "Iași",
  },
  {
    slug: "universitatea-dimitrie-cantemir-targu-mures",
    shortName: "Universitatea Dimitrie Cantemir Târgu Mureș",
    fullName: "Universitatea „Dimitrie Cantemir” din Târgu Mureș",
    city: "Târgu Mureș",
  },
] as const;

async function main() {
    for (const treatment of treatments) {
        await prisma.treatment.upsert({
            where: {
                slug: treatment.slug,
            },
            update: {
                name: treatment.name,
                description: treatment.description,
                isActive: true,
            },
            create: {
                name: treatment.name,
                slug: treatment.slug,
                description: treatment.description,
                isActive: true,
            },
        });
    }

    for (const city of cities) {
        await prisma.city.upsert({
            where: {
                slug: city.slug,
            },
            update: {
                name: city.name,
                isActive: true,
            },
            create: {
                name: city.name,
                slug: city.slug,
                isActive: true,
            },
        });
    }

    for (const [sortOrder, university] of universities.entries()) {
        await prisma.university.upsert({
            where: {
                slug: university.slug,
            },
            update: {
                shortName: university.shortName,
                fullName: university.fullName,
                city: university.city,
                isActive: true,
                sortOrder,
            },
            create: {
                ...university,
                isActive: true,
                sortOrder,
            },
        });
    }

    console.log(
        `Au fost configurate ${treatments.length} tratamente, ${cities.length} orașe și ${universities.length} universități.`,
    );
}

main()
    .catch((error: unknown) => {
        console.error("Seed-ul a eșuat:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
