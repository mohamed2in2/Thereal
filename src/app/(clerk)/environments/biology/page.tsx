"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import { ProfileGuard } from "@/components/auth/ProfileGuard";
import { fetchMeWithRetry, type MeUser } from "@/lib/fetch-me";
import {
  updateIQ, getIQData, getRecommendedDifficulty, vibrate,
  SKILL_LABELS, SKILL_COLORS, SUBJECT_SKILLS,
  levelToDifficulty, difficultyToStartLevel, levelToTimer,
  type Difficulty, type IQData, type GameResult,
} from "@/lib/iq-system";
import { GameFeedback } from "@/components/ai/GameFeedback";

/* ─── Genetics Game Data & Generator ───────────────────────────────────── */
const GENETICS_TRAITS = [
  { name: "الطول في نبات البازلاء", dominant: "طويل", recessive: "قصير", domAllele: "T", recAllele: "t" },
  { name: "لون الأزهار في البازلاء", dominant: "أرجواني", recessive: "أبيض", domAllele: "P", recAllele: "p" },
  { name: "شكل البذور في البازلاء", dominant: "أملس", recessive: "مجعد", domAllele: "S", recAllele: "s" },
  { name: "لون البذور في البازلاء", dominant: "أصفر", recessive: "أخضر", domAllele: "Y", recAllele: "y" },
  { name: "لون العيون عند الإنسان", dominant: "بني", recessive: "أزرق", domAllele: "B", recAllele: "b" },
  { name: "شكل الشعر عند الإنسان", dominant: "مجعد", recessive: "مستقيم", domAllele: "C", recAllele: "c" }
];

interface GeneticsQuestion {
  type: "fill_blank" | "ratio" | "blood_blank" | "blood_ratio" | "sex_linked" | "dihybrid";
  question: string;
  hint: string;
  p1Alleles: string[];
  p2Alleles: string[];
  grid: string[][];
  blankPos?: { r: number; c: number };
  choices: string[];
  answer: string;
  explanation: string;
  crossText: string;
}

function genGeneticsQ(level: number, usedQuestions: Set<string>): GeneticsQuestion {
  const isEasy = level <= 3;
  const isMedium = level > 3 && level <= 7;
  
  let attempts = 0;
  while (attempts < 100) {
    attempts++;
    
    if (isEasy) {
      const trait = GENETICS_TRAITS[Math.floor(Math.random() * GENETICS_TRAITS.length)];
      const gens = [trait.domAllele + trait.domAllele, trait.domAllele + trait.recAllele, trait.recAllele + trait.recAllele];
      const p1 = gens[Math.floor(Math.random() * 3)];
      const p2 = gens[Math.floor(Math.random() * 3)];
      
      const p1Alleles = [p1[0], p1[1]];
      const p2Alleles = [p2[0], p2[1]];
      
      const grid = [
        [p2Alleles[0] + p1Alleles[0], p2Alleles[1] + p1Alleles[0]],
        [p2Alleles[0] + p1Alleles[1], p2Alleles[1] + p1Alleles[1]]
      ].map(row => row.map(allele => {
        if (allele === trait.recAllele + trait.domAllele) return trait.domAllele + trait.recAllele;
        return allele;
      }));
      
      const crossText = `${p1} × ${p2}`;
      const qType = Math.random() < 0.5 ? "fill_blank" : "ratio";
      const key = `monohybrid-${qType}-${crossText}-${trait.domAllele}`;
      if (usedQuestions.has(key)) continue;
      usedQuestions.add(key);
      
      if (qType === "fill_blank") {
        const r = Math.floor(Math.random() * 2);
        const c = Math.floor(Math.random() * 2);
        const answer = grid[r][c];
        
        const choices = Array.from(new Set([
          trait.domAllele + trait.domAllele,
          trait.domAllele + trait.recAllele,
          trait.recAllele + trait.recAllele,
          trait.domAllele + "X"
        ])).slice(0, 4);
        while (choices.length < 4) choices.push(trait.recAllele + "Y");
        
        return {
          type: "fill_blank",
          question: `أكمل مربع بانيت التالي لتهجين (${crossText}): ما هو الطراز الجيني المناسب للمربع الفارغ (؟)؟`,
          hint: `الأليل السائد هو ${trait.domAllele} (${trait.dominant}) والأليل المتنحي هو ${trait.recAllele} (${trait.recessive}). ادمج أليل الصف من اليسار مع أليل العمود من الأعلى.`,
          p1Alleles,
          p2Alleles,
          grid,
          blankPos: { r, c },
          choices: choices.sort(() => Math.random() - 0.5),
          answer,
          explanation: `خلال التهجين، يرث الأبناء أليلاً واحداً من كل أب، مما ينتج الطراز ${answer} في هذا المربع.`,
          crossText
        };
      } else {
        const ratioType = Math.random() < 0.5 ? "pheno" : "geno";
        let targetLabel = "";
        let count = 0;
        let explanation = "";
        
        if (ratioType === "pheno") {
          const showDominant = Math.random() < 0.5;
          targetLabel = showDominant ? trait.dominant : trait.recessive;
          
          grid.forEach(row => row.forEach(cell => {
            const hasDom = cell.includes(trait.domAllele);
            if (showDominant && hasDom) count++;
            if (!showDominant && !hasDom) count++;
          }));
          explanation = showDominant 
            ? `الصفة السائدة (${trait.dominant}) تظهر إذا كان الطراز يحتوي على أليل سائد واحد على الأقل (${trait.domAllele}).`
            : `الصفة المتنحية (${trait.recessive}) لا تظهر إلا إذا كان الطراز نقياً متنحياً (${trait.recAllele}${trait.recAllele}).`;
        } else {
          const targetGeno = gens[Math.floor(Math.random() * 3)];
          const labels: Record<string, string> = {
            [trait.domAllele + trait.domAllele]: `نقي سائد (${trait.domAllele}${trait.domAllele})`,
            [trait.domAllele + trait.recAllele]: `هجين (${trait.domAllele}${trait.recAllele})`,
            [trait.recAllele + trait.recAllele]: `نقي متنحي (${trait.recAllele}${trait.recAllele})`
          };
          targetLabel = labels[targetGeno];
          grid.forEach(row => row.forEach(cell => {
            if (cell === targetGeno) count++;
          }));
          explanation = `عدّ المربعات في جدول بانيت التي تحتوي على التركيب ${targetGeno}.`;
        }
        
        const pct = (count / 4) * 100;
        const answer = `${pct}%`;
        const choices = ["0%", "25%", "50%", "75%", "100%"];
        
        return {
          type: "ratio",
          question: `في تهجين (${crossText}) لصفة (${trait.name})، ما هي النسبة المئوية المتوقعة للأبناء ذوي المظهر/التركيب: ${targetLabel}؟`,
          hint: `احسب عدد المربعات التي تمثل هذه الصفة في مربع بانيت وقسمها على 4 لتعرف النسبة المئوية.`,
          p1Alleles,
          p2Alleles,
          grid,
          choices,
          answer,
          explanation: `${explanation} النسبة هي ${count} من أصل 4، أي ${answer}.`,
          crossText
        };
      }
    } else if (isMedium) {
      const isBlood = Math.random() < 0.5;
      
      if (isBlood) {
        const parentPool = ["IA_IA", "IA_IO", "IB_IB", "IB_IO", "IA_IB", "IO_IO"];
        const p1 = parentPool[Math.floor(Math.random() * parentPool.length)];
        const p2 = parentPool[Math.floor(Math.random() * parentPool.length)];
        
        const mapAlleles = (p: string) => p.split("_");
        const a1 = mapAlleles(p1);
        const a2 = mapAlleles(p2);
        
        const formatBloodGeno = (g1: string, g2: string) => {
          if (g1 === "IO" && g2 !== "IO") return g2 + g1;
          if (g2 === "IA" && g1 === "IB") return g2 + g1;
          return g1 + g2;
        };
        
        const grid = [
          [formatBloodGeno(a2[0], a1[0]), formatBloodGeno(a2[1], a1[0])],
          [formatBloodGeno(a2[0], a1[1]), formatBloodGeno(a2[1], a1[1])]
        ];
        
        const getPheno = (geno: string) => {
          if (geno.includes("IA") && geno.includes("IB")) return "AB";
          if (geno.includes("IA")) return "A";
          if (geno.includes("IB")) return "B";
          return "O";
        };
        
        const parseDisplay = (s: string) => s.replace("IA", "Iᴬ").replace("IB", "Iᴮ").replace("IO", "i");
        const crossText = `${parseDisplay(a1[0])}${parseDisplay(a1[1])} × ${parseDisplay(a2[0])}${parseDisplay(a2[1])}`;
        const key = `blood-${crossText}`;
        if (usedQuestions.has(key)) continue;
        usedQuestions.add(key);
        
        const qType = Math.random() < 0.5 ? "blood_blank" : "blood_ratio";
        const gridDisplay = grid.map(r => r.map(parseDisplay));
        
        if (qType === "blood_blank") {
          const r = Math.floor(Math.random() * 2);
          const c = Math.floor(Math.random() * 2);
          const answer = gridDisplay[r][c];
          
          const choices = Array.from(new Set([
            answer,
            parseDisplay("IAIA"),
            parseDisplay("IAIB"),
            parseDisplay("IBIO"),
            parseDisplay("IOIO")
          ])).slice(0, 4);
          while (choices.length < 4) choices.push(parseDisplay("IAIO"));
          
          return {
            type: "blood_blank",
            question: `أكمل مربع بانيت التالي لفصائل الدم للمزاوجة (${crossText}): ما هو الطراز الجيني للمربع الفارغ (؟)؟`,
            hint: `الأليلات Iᴬ و Iᴮ سائدة سيادة مشتركة، بينما i متحي. ادمج الأليل من اليسار مع الأعلى.`,
            p1Alleles: a1.map(parseDisplay),
            p2Alleles: a2.map(parseDisplay),
            grid: gridDisplay,
            blankPos: { r, c },
            choices: choices.sort(() => Math.random() - 0.5),
            answer,
            explanation: `دمج الأليلات ينتج الطراز الجيني ${answer}.`,
            crossText
          };
        } else {
          const targetPheno = ["A", "B", "AB", "O"][Math.floor(Math.random() * 4)];
          let count = 0;
          grid.forEach(row => row.forEach(cell => {
            if (getPheno(cell) === targetPheno) count++;
          }));
          
          const pct = (count / 4) * 100;
          const answer = `${pct}%`;
          const choices = ["0%", "25%", "50%", "75%", "100%"];
          
          return {
            type: "blood_ratio",
            question: `عند تزاوج أبوين بطراز (${crossText})، ما هو احتمال (بالنسبة المئوية) ولادة طفل بفصيلة دم (${targetPheno})؟`,
            hint: `ابحث عن الطرز الجينية التي تعطي فصيلة الدم ${targetPheno}: IᴬIᴬ أو Iᴬi يعطي A، و IᴮIᴮ أو Iᴮi يعطي B، و IᴬIᴮ يعطي AB، و ii يعطي O.`,
            p1Alleles: a1.map(parseDisplay),
            p2Alleles: a2.map(parseDisplay),
            grid: gridDisplay,
            choices,
            answer,
            explanation: `الفصيلة ${targetPheno} تظهر في ${count} مربعات من أصل 4، والنسبة هي ${answer}.`,
            crossText
          };
        }
      } else {
        const gens = ["RR", "RW", "WW"];
        const p1 = gens[Math.floor(Math.random() * gens.length)];
        const p2 = gens[Math.floor(Math.random() * gens.length)];
        
        const a1 = p1.split("");
        const a2 = p2.split("");
        
        const grid = [
          [a2[0] + a1[0], a2[1] + a1[0]],
          [a2[0] + a1[1], a2[1] + a1[1]]
        ].map(row => row.map(cell => cell === "WR" ? "RW" : cell));
        
        const crossText = `${p1} × ${p2}`;
        const key = `snapdragon-${crossText}`;
        if (usedQuestions.has(key)) continue;
        usedQuestions.add(key);
        
        const targetColor = ["الأحمر (RR)", "الوردي (RW)", "الأبيض (WW)"][Math.floor(Math.random() * 3)];
        const targetGeno = targetColor.includes("RR") ? "RR" : targetColor.includes("RW") ? "RW" : "WW";
        
        let count = 0;
        grid.forEach(row => row.forEach(cell => {
          if (cell === targetGeno) count++;
        }));
        
        const pct = (count / 4) * 100;
        const answer = `${pct}%`;
        const choices = ["0%", "25%", "50%", "75%", "100%"];
        
        return {
          type: "ratio",
          question: `في نبات حنك السبع (سيادة غير تامة)، عند تزاوج نباتين (${crossText})، ما هي نسبة الأزهار ذات اللون ${targetColor}؟`,
          hint: `اللون الوردي هو صفة وسطية ناتجة عن الطراز الهجين RW. الأحمر هو RR والأبيض هو WW.`,
          p1Alleles: a1,
          p2Alleles: a2,
          grid,
          choices,
          answer,
          explanation: `الطراز ${targetGeno} يمثل اللون ${targetColor} ويظهر بنسبة ${count}/4 وهي ${answer}.`,
          crossText
        };
      }
    } else {
      const isSexLinked = Math.random() < 0.5;
      
      if (isSexLinked) {
        const mothers = ["XCXC", "XCXc", "XcXc"];
        const fathers = ["XCY", "XcY"];
        
        const p1 = mothers[Math.floor(Math.random() * 3)];
        const p2 = fathers[Math.floor(Math.random() * 2)];
        
        const a1 = p1.match(/X./g) || ["XC", "XC"];
        const a2 = [p2.substring(0, 2), p2.substring(2)];
        
        const grid = [
          [a2[0] + a1[0], a2[1] + a1[0]],
          [a2[0] + a1[1], a2[1] + a1[1]]
        ].map(row => row.map(cell => {
          let alleles = cell.match(/X.|Y/g) || [];
          alleles.sort((x, y) => {
            if (x === "Y") return 1;
            if (y === "Y") return -1;
            return x < y ? 1 : -1;
          });
          return alleles.join("");
        }));
        
        const parseHtml = (s: string) => s.replace(/XC/g, "Xᴮ").replace(/Xc/g, "Xᵇ");
        
        const crossText = `${parseHtml(p1)} × ${parseHtml(p2)}`;
        const key = `sexlinked-${crossText}`;
        if (usedQuestions.has(key)) continue;
        usedQuestions.add(key);
        
        const qChoices = [
          { q: "ما هي نسبة الذكور المصابين بعمى الألوان من بين كل الأبناء؟", f: (g: string[][]) => {
              let hit = 0;
              g.flat().forEach(cell => { if (cell.endsWith("Y") && cell.includes("Xc")) hit++; });
              return (hit / 4) * 100;
            }, expl: "الذكور المصابون هم الذين لديهم التركيب XᶜY."
          },
          { q: "ما هي نسبة الإناث الحاملات للمرض (ناقلات غير مصابات) من بين كل الأبناء؟", f: (g: string[][]) => {
              let hit = 0;
              g.flat().forEach(cell => { if (!cell.includes("Y") && cell.includes("XC") && cell.includes("Xc")) hit++; });
              return (hit / 4) * 100;
            }, expl: "الإناث الحاملات للمرض لديهن أليل سليم وأليل مصاب XᴮXᵇ."
          },
          { q: "ما نسبة الأبناء السليمين تماماً (ذكور وإناث غير حاملين للمرض)؟", f: (g: string[][]) => {
              let hit = 0;
              g.flat().forEach(cell => {
                if (cell === "XCXCY" || cell === "XCXC" || cell === "XCY") hit++;
              });
              return (hit / 4) * 100;
            }, expl: "السليمون تماماً هم الذكور XᴮY والإناث النقية XᴮXᴮ."
          }
        ];
        
        const chosenQ = qChoices[Math.floor(Math.random() * qChoices.length)];
        const pct = chosenQ.f(grid);
        const answer = `${pct}%`;
        const choices = ["0%", "25%", "50%", "75%", "100%"];
        
        return {
          type: "sex_linked",
          question: `في وراثة مرض عمى الألوان (مرتبط بالجنس)، عند زواج أب وأم بطراز (${crossText})، ${chosenQ.q}`,
          hint: `الكروموسوم Y لا يحمل جينات عمى الألوان. الذكور يرثون X من الأم و Y من الأب. الإناث يرثن X من كلا الأبوين.`,
          p1Alleles: a1.map(parseHtml),
          p2Alleles: a2.map(parseHtml),
          grid: grid.map(r => r.map(parseHtml)),
          choices,
          answer,
          explanation: `${chosenQ.expl} النسبة هي ${answer}.`,
          crossText
        };
      } else {
        const crosses = [
          {
            p1: "RrYy", p2: "rryy",
            grid: [
              ["RrYy", "Rryy", "rrYy", "rryy"]
            ],
            text: "RrYy × rryy (تهجين تجريبي)",
            questions: [
              { q: "ما احتمال الحصول على طراز جيني RrYy؟", a: "1/4", expl: "التهجين ينتج 4 طرز بنسب متساوية 1:1:1:1." },
              { q: "ما احتمال الحصول على طراز مظهري متنحي للصفتين (rryy)؟", a: "1/4", expl: "ربع الأبناء يكون طرازهم rryy." }
            ]
          },
          {
            p1: "RrYy", p2: "RrYy",
            grid: [],
            text: "RrYy × RrYy (تهجين ثنائي خليط)",
            questions: [
              { q: "ما احتمال الحصول على بذور مجعدة خضراء (rryy)؟", a: "1/16", expl: "نسبة المتنحي النقي للصفتين في التهجين الثنائي هي 1/16." },
              { q: "ما نسبة الطراز المظهري السائد للصفتين معاً؟", a: "9/16", expl: "الصفات السائدة للصفتين تظهر بنسبة 9/16." },
              { q: "ما نسبة الطراز المظهري السائد لصفة واحدة فقط؟", a: "3/16", expl: "تظهر الصفة السائدة الأولى مع المتنحية الثانية بنسبة 3/16." }
            ]
          }
        ];
        
        const chosenCross = crosses[Math.floor(Math.random() * crosses.length)];
        const chosenQ = chosenCross.questions[Math.floor(Math.random() * chosenCross.questions.length)];
        
        const crossText = chosenCross.text;
        const key = `dihybrid-${crossText}-${chosenQ.q}`;
        if (usedQuestions.has(key)) continue;
        usedQuestions.add(key);
        
        return {
          type: "dihybrid",
          question: `في تهجين صفتين معاً (شكل ولون البذور RrYy)، عند تزاوج نباتين (${crossText})، ${chosenQ.q}`,
          hint: `تذكر التوزيع الحر للجينات. نسبة التهجين الثنائي لخليطين RrYy x RrYy هي 9:3:3:1.`,
          p1Alleles: ["RY", "Ry", "rY", "ry"],
          p2Alleles: chosenCross.p1 === chosenCross.p2 ? ["RY", "Ry", "rY", "ry"] : ["ry"],
          grid: [],
          choices: ["1/16", "3/16", "9/16", "1/4", "1/2"].sort(() => Math.random() - 0.5).slice(0, 4).concat(chosenQ.a).filter((v, i, a) => a.indexOf(v) === i).slice(0, 4),
          answer: chosenQ.a,
          explanation: chosenQ.expl,
          crossText
        };
      }
    }
  }
  
  return {
    type: "ratio",
    question: "عند تهجين Tt x Tt، ما نسبة ظهور النباتات القصير (tt)؟",
    hint: "قصر الساق صفة متنحية.",
    p1Alleles: ["T", "t"],
    p2Alleles: ["T", "t"],
    grid: [["TT", "Tt"], ["Tt", "tt"]],
    choices: ["0%", "25%", "50%", "75%", "100%"],
    answer: "25%",
    explanation: "tt يمثل 1 من 4 مربعات، أي 25%.",
    crossText: "Tt × Tt"
  };
}

/* ─── Cell Tap Data & Templating ────────────────────────────────────────── */
interface CellFact {
  id: string;
  name: string;
  category: "easy" | "medium" | "hard";
  clues: string[];
  explanation: string;
}

const CELL_FACTS: CellFact[] = [
  { id: "1", name: "الميتوكوندريا", category: "easy", clues: ["عضية مسؤولة عن التنفس الخلوي وإنتاج الطاقة (ATP)", "تعتبر بمثابة مصنع الطاقة الرئيسي داخل الخلايا", "تتميز بغشاء مزدوج وتحتوي على حمض نووي خاص بها"], explanation: "الميتوكوندريا تولد الطاقة للخلية" },
  { id: "2", name: "النواة", category: "easy", clues: ["عضية تحتوي على المادة الوراثية وتتحكم في أنشطة الخلية", "مركز السيطرة الرئيسي ومخزن الحمض النووي (DNA)", "تتميز بغلاف نووي يحيط بالمادة الوراثية"], explanation: "النواة تتحكم بالخلية وتحفظ الـ DNA" },
  { id: "3", name: "الريبوسومات", category: "easy", clues: ["العضية المسؤولة عن تصنيع وبناء البروتينات", "تقوم بترجمة الحمض النووي الريبوزي mRNA إلى بروتينات", "عضية صغيرة جداً غير غشائية تنتج سلاسل الببتيد"], explanation: "الريبوسومات تبني البروتينات" },
  { id: "4", name: "البلاستيدات الخضراء", category: "easy", clues: ["عضية نباتية تجري عملية البناء الضوئي لصنع الغذاء", "تتحكم في امتصاص أشعة الشمس لإنتاج السكر في النبات", "عضية تحتوي على الكلوروفيل وتكسب النبات لونه الأخضر"], explanation: "البلاستيدات تجري البناء الضوئي" },
  { id: "5", name: "الغشاء الخلوي", category: "easy", clues: ["غلاف ينظم دخول وخروج المواد من وإلى الخلية", "غشاء شبه منفذ يتميز بالنفاذية الاختيارية", "يحمي الخلية ويحافظ على اتزانها الداخلي بيئياً"], explanation: "الغشاء ينظم مرور المواد بالخلية" },
  { id: "6", name: "جدار الخلية", category: "easy", clues: ["جدار صلب يحيط بالخلايا النباتية لمنحها الدعامة والشكل", "يتكون أساساً من مادة السيليلوز ويحمي الخلية النباتية", "يمنع انفجار الخلية النباتية نتيجة الضغط الأسموزي"], explanation: "الجدار يوفر حماية ودعامة للنبات" },
  { id: "7", name: "جهاز جولجي", category: "medium", clues: ["عضية تقوم بتعديل وتعبئة البروتينات وتصديرها", "مجموعة من الأكياس الغشائية المفلطحة التي تشبه مكتب البريد", "تقوم بإضافة السكريات للبروتينات لإنتاج البروتينات السكرية"], explanation: "جهاز جولجي يغلف ويشحن البروتينات" },
  { id: "8", name: "الليسوسومات", category: "medium", clues: ["عضيات هاضمة تحتوي على إنزيمات لتحليل المواد التالفة", "الجسيمات الحالة التي تدمر البكتيريا والعضيات الهرمة", "تقوم بعملية التحلل الذاتي عند موت الخلية"], explanation: "الليسوسومات تهضم الفضلات بالخلية" },
  { id: "9", name: "الشبكة الإندوبلازمية الخشنة", category: "medium", clues: ["شبكة تنقل المواد وتتميز بوجود الريبوسومات على سطحها", "مسؤولة عن تعديل ونقل البروتينات المصنعة حديثاً", "أقنية متصلة بالنواة تسهم في معالجة سلاسل البروتين"], explanation: "الخشنة تنقل وتعدل البروتينات" },
  { id: "10", name: "الشبكة الإندوبلازمية الملساء", category: "medium", clues: ["عضية تقوم بتصنيع الدهون وإزالة السموم من الخلية", "شبكة أقنية تخلو من الريبوسومات على سطحها الخارجي", "تساهم في تخزين الكالسيوم واستقلاب الكربوهيدرات"], explanation: "الملساء تبني الدهون وتزيل السموم" },
  { id: "11", name: "السيتوبلازم", category: "easy", clues: ["سائل شبه هلامي تطفو فيه العضيات الخلوية المختلفة", "المادة السائلة التي تمتد بين النواة والغشاء الخلوي", "تحدث فيه معظم التفاعلات الكيميائية الأساسية للخلية"], explanation: "السيتوبلازم سائل الخلية الأساسي" },
  { id: "12", name: "الفجوة العصارية", category: "medium", clues: ["عضية تخزن الماء والمواد الغذائية والفضلات بالخلية", "تكون كبيرة ومركزية في الخلايا النباتية وصغيرة في الحيوانية", "تحافظ على ضغط الامتلاء والانتفاخ داخل الخلايا النباتية"], explanation: "الفجوة العصارية تخزن المياه والغذاء" },
  { id: "13", name: "النوية", category: "medium", clues: ["جسم داكن داخل النواة مسؤول عن بناء الريبوسومات", "تقوم بتصنيع الحمض النووي الريبوزي rRNA وتجميع الريبوسومات", "تعتبر مركز تجميع الآلات المصنعة للبروتين"], explanation: "النوية تصنع الريبوسومات" },
  { id: "14", name: "البيروكسيسومات", category: "hard", clues: ["عضيات تفكك الأحماض الدهنية وتنتج بيروكسيد الهيدروجين", "تحتوي على إنزيم الكاتالاز لتفكيك السموم والماء الأكسجيني", "تساهم في حماية الخلية من الجذور الحرة الضارة"], explanation: "البيروكسيسومات تحلل السموم الخلوية" },
  { id: "15", name: "الهيكل الخلوي", category: "hard", clues: ["شبكة من الألياف البروتينية تدعم شكل الخلية وتساعد في حركتها", "تتكون من الأنيبيبات الدقيقة والخيوط الدقيقة والوسطية", "تعمل كطرق سريعة لنقل العضيات داخل السيتوبلازم"], explanation: "الهيكل الخلوي يدعم الحركة والشكل" },
  { id: "16", name: "الجسيم المركزي (السنتريول)", category: "hard", clues: ["تركيب ينظم خيوط المغزل أثناء انقسام الخلايا الحيوانية", "يتكون من تسع مجموعات من الأنيبيبات الدقيقة الثلاثية", "عضية غير غشائية توجد بالقرب من نواة الخلايا الحيوانية فقط"], explanation: "الجسيم المركزي يوجه انقسام الخلايا" },
  { id: "17", name: "الغشاء النووي", category: "easy", clues: ["غشاء مزدوج يحيط بالنواة ويحتوي على ثقوب نووية", "يفصل مكونات النواة عن السيتوبلازم وينظم حركتها", "يسمح بمرور الـ RNA والريبوسومات خارج النواة"], explanation: "الغشاء النووي يحمي محتوى النواة" },
  { id: "18", name: "الكروماتين", category: "hard", clues: ["خليط من DNA والبروتينات يتكثف ليشكل الكروموسومات", "الشكل غير المتكثف للمادة الوراثية خلال الطور البيني", "تلتف خيوطه حول بروتينات الهيستون لحفظ المعلومات"], explanation: "الكروماتين يمثل حمض DNA غير المتكثف" },
  { id: "19", name: "الكلوروفيل", category: "easy", clues: ["صبغة خضراء تمتص الضوء للقيام بالبناء الضوئي", "الصبغة الكيميائية المتواجدة داخل ثايلات الثايلاكويد", "تحول الطاقة الضوئية إلى طاقة كيميائية في النباتات"], explanation: "الكلوروفيل صبغة امتصاص الضوء" },
  { id: "20", name: "الأهداب والأسواط", category: "medium", clues: ["تراكيب شعرية تمتد من سطح الخلية وتساعد في الحركة", "تتكون من أنيبيبات دقيقة بترتيب خاص (9+2)", "تستخدمها البكتيريا أو الخلايا المفردة للانتقال"], explanation: "الأهداب والأسواط أدوات حركة الخلية" },
  { id: "21", name: "الدهون المفسفرة", category: "hard", clues: ["الجزيء الرئيسي المكون للغشاء الخلوي برأس محب وذيل كاره للماء", "تترتب في طبقتين لتشكل حاجزاً مرناً يحيط بالخلية", "تمنع مرور الجزيئات الذائبة في الماء بحرية عبر الغشاء"], explanation: "الدهون المفسفرة تشكل الهيكل الغشائي" }
];

// Generator for Cell questions based on level (1-10) with duplicate prevention
function genCellQ(level: number, usedQuestions: Set<string>) {
  const cat = level <= 3 ? "easy" : level <= 7 ? "medium" : "hard";
  
  // Filter facts matching the category
  let pool = CELL_FACTS.filter(f => f.category === cat);
  if (pool.length === 0) pool = CELL_FACTS;

  let chosenFact = pool[Math.floor(Math.random() * pool.length)];
  let clue = chosenFact.clues[Math.floor(Math.random() * chosenFact.clues.length)];
  let key = `${chosenFact.id}-${clue}`;

  // Duplicate prevention check
  let attempts = 0;
  while (usedQuestions.has(key) && attempts < 100) {
    chosenFact = pool[Math.floor(Math.random() * pool.length)];
    clue = chosenFact.clues[Math.floor(Math.random() * chosenFact.clues.length)];
    key = `${chosenFact.id}-${clue}`;
    attempts++;
  }
  usedQuestions.add(key);

  const answer = chosenFact.name;
  
  // Get 3 random distractors from other organelles
  const others = CELL_FACTS.filter(f => f.name !== answer).map(f => f.name);
  const wrong = others.sort(() => Math.random() - 0.5).slice(0, 3);
  const choices = [answer, ...wrong].sort(() => Math.random() - 0.5);

  return { question: clue, answer, choices, explanation: chosenFact.explanation };
}

/* ─── Constants ─────────────────────────────────────────────────────────── */
const TOTAL_Q = 10;
const BASE_TIMERS = { easy: 16, medium: 12, hard: 8 };

const DIFF_LABEL: Record<Difficulty, string> = { easy: "سهل", medium: "متوسط", hard: "صعب" };
const DIFF_COLOR: Record<Difficulty, string> = { easy: "#1D9E75", medium: "#EF9F27", hard: "#D4537E" };

/* ─── Level badge ────────────────────────────────────────────────────────── */
function LevelBadge({ level, anim }: { level: number; anim: boolean }) {
  const diff = levelToDifficulty(level);
  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black text-white transition-all ${anim ? "scale-125" : ""}`}
        style={{ background: DIFF_COLOR[diff] }}>
        Lv.{level}
        {anim && <span className="mr-1">⬆️</span>}
      </div>
    </div>
  );
}

/* ─── DNA Match Game ────────────────────────────────────────────────────── */
function PunnettSquareGame({ onFinish, isAdaptive }: { onFinish: () => void; isAdaptive: boolean }) {
  const [diff, setDiff] = useState<Difficulty>(() => getRecommendedDifficulty("biology"));
  const startLevel = difficultyToStartLevel(diff);
  const [level, setLevel] = useState(startLevel);
  const [levelAnim, setLevelAnim] = useState(false);
  const [state, setState] = useState<"idle" | "playing" | "result">("idle");
  
  const usedQuestionsRef = useRef<Set<string>>(new Set());
  const [q, setQ] = useState<GeneticsQuestion | null>(null);
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [timerPct, setTimerPct] = useState(100);
  const [result, setResult] = useState<{ correct: number; sessionScore: number; newIQ: number } | null>(null);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const totalMsRef = useRef(0);
  const tStartRef = useRef(0);
  const correctRef = useRef(0);
  const streakRef = useRef(0);
  const maxStreakRef = useRef(0);
  const levelsRef = useRef<number[]>([]);
  const levelRef = useRef(startLevel);

  const clear = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (advRef.current) clearTimeout(advRef.current);
  };

  const nextQ = useCallback((idx: number) => {
    if (idx >= TOTAL_Q) {
      const avgLevel = levelsRef.current.reduce((a, b) => a + b, 0) / levelsRef.current.length;
      const gameResult: GameResult = {
        correct: correctRef.current,
        total: TOTAL_Q,
        totalTimeMs: totalMsRef.current,
        avgLevel,
        maxStreak: maxStreakRef.current,
        difficulty: levelToDifficulty(levelRef.current),
      };
      const res = updateIQ("biology", gameResult);
      setResult({ correct: correctRef.current, sessionScore: res.sessionScore, newIQ: res.newOverallIQ });
      setState("result");
      onFinish();
      return;
    }
    
    const cur = levelRef.current;
    levelsRef.current.push(cur);
    const secs = levelToTimer(cur, BASE_TIMERS);
    
    setQ(genGeneticsQ(cur, usedQuestionsRef.current));
    setSelected(null);
    setShowHint(false);
    setQIdx(idx);
    setTimerPct(100);
    
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += 100;
      setTimerPct(Math.max(0, 100 - (elapsed / (secs * 1000)) * 100));
      if (elapsed >= secs * 1000) {
        clearInterval(timerRef.current!);
        vibrate("wrong");
        levelRef.current = Math.max(1, levelRef.current - 1);
        setLevel(levelRef.current);
        setSelected("__timeout__");
        const now = Date.now();
        totalMsRef.current += now - tStartRef.current;
        tStartRef.current = now;
        streakRef.current = 0;
        advRef.current = setTimeout(() => nextQ(idx + 1), 1500);
      }
    }, 100);
    tStartRef.current = Date.now();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFinish]);

  const start = () => {
    clear();
    usedQuestionsRef.current.clear();
    correctRef.current = 0;
    streakRef.current = 0;
    maxStreakRef.current = 0;
    levelsRef.current = [];
    totalMsRef.current = 0;
    const startLvl = difficultyToStartLevel(diff);
    levelRef.current = startLvl;
    setLevel(startLvl);
    setCorrect(0);
    setResult(null);
    setState("playing");
    nextQ(0);
  };

  const answer = useCallback((ch: string) => {
    if (selected) return;
    clear();
    setSelected(ch);
    const now = Date.now();
    totalMsRef.current += now - tStartRef.current;
    
    const curLevel = levelRef.current;
    const secs = levelToTimer(curLevel, BASE_TIMERS);
    const timeUsedPct = (now - tStartRef.current) / (secs * 1000);
    
    const ok = ch === q?.answer;
    const newC = correctRef.current + (ok ? 1 : 0);
    correctRef.current = newC;
    setCorrect(newC);
    
    const newStr = ok ? streakRef.current + 1 : 0;
    streakRef.current = newStr;
    maxStreakRef.current = Math.max(maxStreakRef.current, newStr);
    vibrate(ok ? (newStr >= 3 ? "streak" : "correct") : "wrong");

    const prevLvl = levelRef.current;
    if (ok && timeUsedPct < 0.45 && levelRef.current < 10) {
      levelRef.current = Math.min(10, levelRef.current + 1);
      setLevel(levelRef.current);
      if (levelRef.current > prevLvl) {
        setLevelAnim(true);
        setTimeout(() => setLevelAnim(false), 800);
        vibrate("levelup");
      }
    } else if (!ok && levelRef.current > 1) {
      levelRef.current = Math.max(1, levelRef.current - 1);
      setLevel(levelRef.current);
    }
    
    advRef.current = setTimeout(() => nextQ(qIdx + 1), 2000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, q, qIdx, nextQ]);

  useEffect(() => () => clear(), []);

  if (state === "idle") return (
    <div className="rounded-[20px] p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>🧬</div>
      <h3 className="text-xl font-black mb-2" style={{ color: "var(--ink)" }}>تحدي علم الوراثة (مربع بانيت)</h3>
      <p className="text-sm mb-2" style={{ color: "var(--ink)" }}>قم بحل المزاوجات الجينية وحساب الاحتمالات لمربع بانيت</p>
      <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>مستويات متنوعة (سيادة تامة، سيادة مشتركة، فصائل دم، صفات مرتبطة بالجنس) ⚡</p>
      
      {!isAdaptive && (
        <div className="flex gap-2 justify-center mb-6">
          {(["easy", "medium", "hard"] as Difficulty[]).map(d => (
            <button key={d} onClick={() => setDiff(d)} className="px-4 py-2 rounded-xl text-sm font-black transition-all"
              style={{ background: diff === d ? DIFF_COLOR[d] : "var(--surface-2)", color: diff === d ? "#fff" : "var(--ink-3)", border: `2px solid ${diff === d ? DIFF_COLOR[d] : "var(--border)"}` }}>
              {DIFF_LABEL[d]}
            </button>
          ))}
        </div>
      )}
      {isAdaptive && (
        <p className="text-xs mb-5 font-bold" style={{ color: "var(--brand)" }}>
          تم تحديد الصعوبة تلقائياً: {DIFF_LABEL[diff]} ⚡
        </p>
      )}
      
      <button onClick={start} className="w-full py-4 rounded-2xl font-black text-lg text-white" style={{ background: "linear-gradient(135deg,#1D9E75,#7F77DD)" }}>ابدأ اللعب</button>
    </div>
  );

  if (state === "result" && result) return (
    <div className="rounded-[20px] p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 52 }}>{result.correct >= 8 ? "🏆" : result.correct >= 5 ? "⭐" : "💪"}</div>
      <h3 className="text-2xl font-black mb-1" style={{ color: "var(--ink)" }}>{result.correct}/{TOTAL_Q} صحيح</h3>
      <p className="text-xs text-gray-500 mb-3">أعلى مستوى وصلت له: Lv.{Math.max(...levelsRef.current)}</p>
      <div className="rounded-xl p-4 my-4" style={{ background: "var(--brand-soft)", border: "1px solid var(--brand)" }}>
        <div className="text-xs font-bold mb-1" style={{ color: "var(--brand)" }}>نقاط الجلسة</div>
        <div className="text-3xl font-black" style={{ color: "var(--brand)" }}>{result.sessionScore.toLocaleString("ar-EG")}</div>
        <div className="text-xs mt-1" style={{ color: "var(--ink-3)" }}>IQ الكلي: <strong>{result.newIQ}</strong></div>
      </div>
      <GameFeedback
        subject="biology"
        correctAnswers={result.correct}
        totalQuestions={TOTAL_Q}
        totalTimeMs={totalMsRef.current}
        maxLevel={levelsRef.current.length > 0 ? Math.max(...levelsRef.current) : 1}
        maxStreak={maxStreakRef.current}
        difficulty={levelToDifficulty(levelRef.current)}
        autoLoad
      />
      <div className="flex gap-3 mt-3">
        <button onClick={start} className="flex-1 py-3 rounded-xl font-black text-white" style={{ background: "linear-gradient(135deg,#1D9E75,#7F77DD)" }}>مرة أخرى</button>
        <Link href="/environments" className="flex-1 py-3 rounded-xl font-black text-center" style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--border)" }}>البيئات</Link>
      </div>
    </div>
  );

  const renderGridCell = (r: number, c: number) => {
    if (!q) return null;
    const cellVal = q.grid[r][c];
    const isBlank = q.blankPos && q.blankPos.r === r && q.blankPos.c === c;
    
    if (isBlank) {
      return (
        <div className="flex items-center justify-center font-black text-base bg-amber-50 dark:bg-amber-950/20 text-amber-600 border-2 border-dashed border-amber-300 rounded-lg p-2 min-h-[44px]">
          {selected && selected !== "__timeout__" ? selected : "؟"}
        </div>
      );
    }
    
    return (
      <div className="flex items-center justify-center font-black text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg p-2 min-h-[44px]">
        {cellVal}
      </div>
    );
  };

  return (
    <div>
      <div className="h-2 rounded-full mb-4 overflow-hidden" style={{ background: "var(--border)" }}>
        <div className="h-full rounded-full transition-all duration-100" style={{ width: `${timerPct}%`, background: timerPct > 50 ? "#1D9E75" : timerPct > 20 ? "#EF9F27" : "#D4537E" }} />
      </div>
      <div className="flex justify-between items-center mb-3">
        <LevelBadge level={level} anim={levelAnim} />
        <span className="text-xs font-bold" style={{ color: "var(--ink-3)" }}>{qIdx + 1}/{TOTAL_Q}</span>
        <span className="text-xs font-bold" style={{ color: "#1D9E75" }}>✅ {correct}</span>
      </div>

      {q && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-indigo-500">🧬 علم الوراثة</span>
            <button onClick={() => setShowHint(!showHint)} className="px-2 py-1 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg text-[10px] font-bold">
              💡 مساعدة
            </button>
          </div>
          
          <p className="text-sm font-bold leading-relaxed mb-4 text-center" style={{ color: "var(--ink)" }}>{q.question}</p>
          
          {showHint && (
            <p className="text-xs p-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 mb-4 leading-relaxed">💡 {q.hint}</p>
          )}

          {q.grid && q.grid.length > 0 ? (
            <div className="flex flex-col items-center my-4">
              <div className="grid grid-cols-3 gap-1.5 w-full max-w-[240px] text-center font-mono" dir="ltr">
                <div className="flex items-center justify-center font-bold text-[10px] bg-slate-100 dark:bg-slate-800 rounded-lg p-2 text-slate-400">
                  ♂ \ ♀
                </div>
                <div className="flex items-center justify-center font-black text-sm text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg p-2 border border-indigo-200">
                  {q.p1Alleles[0]}
                </div>
                <div className="flex items-center justify-center font-black text-sm text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg p-2 border border-indigo-200">
                  {q.p1Alleles[1]}
                </div>

                <div className="flex items-center justify-center font-black text-sm text-pink-500 bg-pink-50 dark:bg-pink-950/30 rounded-lg p-2 border border-pink-200">
                  {q.p2Alleles[0]}
                </div>
                {renderGridCell(0, 0)}
                {renderGridCell(0, 1)}

                <div className="flex items-center justify-center font-black text-sm text-pink-500 bg-pink-50 dark:bg-pink-950/30 rounded-lg p-2 border border-pink-200">
                  {q.p2Alleles[1]}
                </div>
                {renderGridCell(1, 0)}
                {renderGridCell(1, 1)}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl my-4 border border-dashed border-slate-200">
              <span className="text-sm font-black text-indigo-600">{q.crossText}</span>
            </div>
          )}

          {selected && q.explanation && (
            <div className="text-xs mt-3 p-3 rounded-xl bg-green-50 text-green-700 border border-green-100 leading-relaxed">
              <strong>التفسير العلمي:</strong> {q.explanation}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {q?.choices.map(ch => {
          const isSel = selected === ch;
          const isAns = selected !== null && ch === q.answer;
          const isWrong = isSel && ch !== q.answer;
          return (
            <button key={ch} onClick={() => answer(ch)} disabled={!!selected}
              className="py-4 rounded-2xl text-sm font-black transition-all active:scale-95 leading-snug"
              style={{
                minHeight: 56,
                background: isAns ? "#1D9E75" : isWrong ? "#D4537E" : "var(--surface)",
                color: (isAns || isWrong) ? "#fff" : "var(--ink)",
                border: `2px solid ${isAns ? "#1D9E75" : isWrong ? "#D4537E" : "var(--border)"}`
              }}>
              {ch}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Cell Tap Game ─────────────────────────────────────────────────────── */
function CellTapGame({ onFinish, isAdaptive }: { onFinish: () => void; isAdaptive: boolean }) {
  const [diff, setDiff] = useState<Difficulty>(() => getRecommendedDifficulty("biology"));
  const startLevel = difficultyToStartLevel(diff);
  const [level, setLevel] = useState(startLevel);
  const [levelAnim, setLevelAnim] = useState(false);
  const [state, setState] = useState<"idle" | "playing" | "result">("idle");
  
  const usedQuestionsRef = useRef<Set<string>>(new Set());
  const [q, setQ] = useState<ReturnType<typeof genCellQ> | null>(null);
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [timerPct, setTimerPct] = useState(100);
  const [result, setResult] = useState<{ correct: number; sessionScore: number; newIQ: number } | null>(null);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const totalMsRef = useRef(0);
  const tStartRef = useRef(0);
  const correctRef = useRef(0);
  const streakRef = useRef(0);
  const maxStreakRef = useRef(0);
  const levelsRef = useRef<number[]>([]);
  const levelRef = useRef(startLevel);

  const clear = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (advRef.current) clearTimeout(advRef.current);
  };

  const nextQ = useCallback((idx: number) => {
    if (idx >= TOTAL_Q) {
      const avgLevel = levelsRef.current.reduce((a, b) => a + b, 0) / levelsRef.current.length;
      const gameResult: GameResult = {
        correct: correctRef.current,
        total: TOTAL_Q,
        totalTimeMs: totalMsRef.current,
        avgLevel,
        maxStreak: maxStreakRef.current,
        difficulty: levelToDifficulty(levelRef.current),
      };
      const res = updateIQ("biology", gameResult);
      setResult({ correct: correctRef.current, sessionScore: res.sessionScore, newIQ: res.newOverallIQ });
      setState("result");
      onFinish();
      return;
    }
    
    const cur = levelRef.current;
    levelsRef.current.push(cur);
    const secs = levelToTimer(cur, BASE_TIMERS);
    
    setQ(genCellQ(cur, usedQuestionsRef.current));
    setSelected(null);
    setQIdx(idx);
    setTimerPct(100);
    
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += 100;
      setTimerPct(Math.max(0, 100 - (elapsed / (secs * 1000)) * 100));
      if (elapsed >= secs * 1000) {
        clearInterval(timerRef.current!);
        vibrate("wrong");
        levelRef.current = Math.max(1, levelRef.current - 1);
        setLevel(levelRef.current);
        setSelected("__timeout__");
        const now = Date.now();
        totalMsRef.current += now - tStartRef.current;
        tStartRef.current = now;
        streakRef.current = 0;
        advRef.current = setTimeout(() => nextQ(idx + 1), 1200);
      }
    }, 100);
    tStartRef.current = Date.now();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFinish]);

  const start = () => {
    clear();
    usedQuestionsRef.current.clear();
    correctRef.current = 0;
    streakRef.current = 0;
    maxStreakRef.current = 0;
    levelsRef.current = [];
    totalMsRef.current = 0;
    const startLvl = difficultyToStartLevel(diff);
    levelRef.current = startLvl;
    setLevel(startLvl);
    setCorrect(0);
    setResult(null);
    setState("playing");
    nextQ(0);
  };

  const answer = useCallback((ch: string) => {
    if (selected) return;
    clear();
    setSelected(ch);
    const now = Date.now();
    totalMsRef.current += now - tStartRef.current;
    
    const curLevel = levelRef.current;
    const secs = levelToTimer(curLevel, BASE_TIMERS);
    const timeUsedPct = (now - tStartRef.current) / (secs * 1000);
    
    const ok = ch === q?.answer;
    const newC = correctRef.current + (ok ? 1 : 0);
    correctRef.current = newC;
    setCorrect(newC);
    
    const newStr = ok ? streakRef.current + 1 : 0;
    streakRef.current = newStr;
    maxStreakRef.current = Math.max(maxStreakRef.current, newStr);
    vibrate(ok ? (newStr >= 3 ? "streak" : "correct") : "wrong");

    // Adjust levels dynamically
    const prevLvl = levelRef.current;
    if (ok && timeUsedPct < 0.45 && levelRef.current < 10) {
      levelRef.current = Math.min(10, levelRef.current + 1);
      setLevel(levelRef.current);
      if (levelRef.current > prevLvl) {
        setLevelAnim(true);
        setTimeout(() => setLevelAnim(false), 800);
        vibrate("levelup");
      }
    } else if (!ok && levelRef.current > 1) {
      levelRef.current = Math.max(1, levelRef.current - 1);
      setLevel(levelRef.current);
    }

    advRef.current = setTimeout(() => nextQ(qIdx + 1), 1400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, q, qIdx, nextQ]);

  useEffect(() => () => clear(), []);

  if (state === "idle") return (
    <div className="rounded-[20px] p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>🔬</div>
      <p className="text-sm mb-4" style={{ color: "var(--ink)" }}>اختر العضية الخلوية الصحيحة بناءً على الوصف</p>
      
      {!isAdaptive && (
        <div className="flex gap-2 justify-center mb-6">
          {(["easy", "medium", "hard"] as Difficulty[]).map(d => (
            <button key={d} onClick={() => setDiff(d)} className="px-4 py-2 rounded-xl text-sm font-black"
              style={{ background: diff === d ? DIFF_COLOR[d] : "var(--surface-2)", color: diff === d ? "#fff" : "var(--ink-3)", border: `2px solid ${diff === d ? DIFF_COLOR[d] : "var(--border)"}` }}>
              {DIFF_LABEL[d]}
            </button>
          ))}
        </div>
      )}
      {isAdaptive && (
        <p className="text-xs mb-5 font-bold" style={{ color: "var(--brand)" }}>
          تم تحديد الصعوبة تلقائياً: {DIFF_LABEL[diff]} ⚡
        </p>
      )}
      
      <button onClick={start} className="w-full py-4 rounded-2xl font-black text-lg text-white" style={{ background: "linear-gradient(135deg,#1D9E75,#7F77DD)" }}>ابدأ</button>
    </div>
  );

  if (state === "result" && result) return (
    <div className="rounded-[20px] p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 52 }}>{result.correct >= 8 ? "🏆" : result.correct >= 5 ? "⭐" : "💪"}</div>
      <h3 className="text-2xl font-black mb-1" style={{ color: "var(--ink)" }}>{result.correct}/{TOTAL_Q} صحيح</h3>
      <p className="text-xs text-gray-500 mb-3">أعلى مستوى وصلت له: Lv.{Math.max(...levelsRef.current)}</p>
      <div className="rounded-xl p-4 my-4" style={{ background: "var(--brand-soft)", border: "1px solid var(--brand)" }}>
        <div className="text-xs font-bold mb-1" style={{ color: "var(--brand)" }}>نقاط الجلسة</div>
        <div className="text-3xl font-black" style={{ color: "var(--brand)" }}>{result.sessionScore.toLocaleString("ar-EG")}</div>
        <div className="text-xs mt-1" style={{ color: "var(--ink-3)" }}>IQ الكلي: <strong>{result.newIQ}</strong></div>
      </div>
      <GameFeedback
        subject="biology"
        correctAnswers={result.correct}
        totalQuestions={TOTAL_Q}
        totalTimeMs={totalMsRef.current}
        maxLevel={levelsRef.current.length > 0 ? Math.max(...levelsRef.current) : 1}
        maxStreak={maxStreakRef.current}
        difficulty={levelToDifficulty(levelRef.current)}
        autoLoad
      />
      <div className="flex gap-3 mt-3">
        <button onClick={start} className="flex-1 py-3 rounded-xl font-black text-white" style={{ background: "linear-gradient(135deg,#1D9E75,#7F77DD)" }}>مرة أخرى</button>
        <Link href="/environments" className="flex-1 py-3 rounded-xl font-black text-center" style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--border)" }}>البيئات</Link>
      </div>
    </div>
  );

  return (
    <div>
      <div className="h-2 rounded-full mb-4 overflow-hidden" style={{ background: "var(--border)" }}>
        <div className="h-full rounded-full transition-all duration-100" style={{ width: `${timerPct}%`, background: timerPct > 50 ? "#1D9E75" : timerPct > 20 ? "#EF9F27" : "#D4537E" }} />
      </div>
      <div className="flex justify-between items-center mb-3">
        <LevelBadge level={level} anim={levelAnim} />
        <span className="text-xs font-bold" style={{ color: "var(--ink-3)" }}>{qIdx + 1}/{TOTAL_Q}</span>
        <span className="text-xs font-bold" style={{ color: "#1D9E75" }}>✅ {correct}</span>
      </div>
      <div className="rounded-2xl p-5 mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-bold mb-2" style={{ color: "var(--ink-3)" }}>ما هذه العضية الخلوية؟</p>
        <p className="text-base font-bold leading-relaxed" style={{ color: "var(--ink)" }}>{q?.question}</p>
        {selected && q?.explanation && (
          <p className="text-xs mt-3 p-2 rounded-lg" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>💡 {q.explanation}</p>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {q?.choices.map(ch => {
          const isSel = selected === ch, isAns = selected !== null && ch === q.answer, isWrong = isSel && ch !== q.answer;
          return (
            <button key={ch} onClick={() => answer(ch)} disabled={!!selected}
              className="py-4 rounded-2xl text-sm font-black transition-all active:scale-95 leading-snug"
              style={{
                minHeight: 64,
                background: isAns ? "#1D9E75" : isWrong ? "#D4537E" : "var(--surface)",
                color: (isAns || isWrong) ? "#fff" : "var(--ink)",
                border: `2px solid ${isAns ? "#1D9E75" : isWrong ? "#D4537E" : "var(--border)"}`
              }}>
              {ch}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default function BiologyEnvironment() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [tab, setTab] = useState<"dna" | "cell">("dna");
  const [iqData, setIqData] = useState<IQData>(() => getIQData());
  const [isAdaptive, setIsAdaptive] = useState(false);

  useEffect(() => {
    fetchMeWithRetry(2, 100).then(me => setUser(me)).catch(() => {});
    
    // Fetch adaptive difficulty setting from server
    fetch("/api/student/iq")
      .then(res => res.json())
      .then(data => {
        if (data && data.isAdaptive) {
          setIsAdaptive(true);
        }
      })
      .catch(() => {});
  }, []);

  const refreshIQ = () => setIqData(getIQData());
  const skills = SUBJECT_SKILLS["biology"];

  return (
    <ProfileGuard>
      <div className="flex flex-col min-h-screen" style={{ background: "var(--bg)" }}>
        <Navbar user={user ? { name: user.name, role: user.role } : null} />
        <main className="flex-1 max-w-xl mx-auto w-full px-4 py-6">
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <Link href="/environments" className="flex items-center gap-1 text-sm font-bold" style={{ color: "var(--ink-3)" }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              البيئات
            </Link>
            <span style={{ color: "var(--border-strong)" }}>›</span>
            <span className="text-sm font-black" style={{ color: "var(--ink)" }}>🔬 الأحياء</span>
            <div className="mr-auto flex items-center gap-2 flex-wrap">
              {(skills as (keyof typeof SKILL_LABELS)[]).map(sk => (
                <span key={sk} className="px-2 py-1 rounded-full text-xs font-bold"
                  style={{ background: SKILL_COLORS[sk] + "22", color: SKILL_COLORS[sk] }}>
                  {SKILL_LABELS[sk].split(" ").pop()} {iqData.skills[sk].score}
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-2 mb-6 p-1 rounded-2xl" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            {([["dna", "🧬 علم الوراثة"], ["cell", "🔬 تركيبة الخلية"]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className="flex-1 py-3 text-sm font-black rounded-xl transition-all"
                style={{ background: tab === id ? "var(--surface)" : "transparent", color: tab === id ? "var(--ink)" : "var(--ink-3)", boxShadow: tab === id ? "var(--shadow-sm)" : "none" }}>
                {label}
              </button>
            ))}
          </div>

          {tab === "dna" && <PunnettSquareGame key="dna" onFinish={refreshIQ} isAdaptive={isAdaptive} />}
          {tab === "cell" && <CellTapGame key="cell" onFinish={refreshIQ} isAdaptive={isAdaptive} />}
        </main>
        <Footer />
      </div>
    </ProfileGuard>
  );
}
