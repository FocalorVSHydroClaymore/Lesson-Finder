// Sheet Configurations
const KEC_SHEET_ID = "1Uj77LX3qwVM2jtZEVe3hJt-mjhSvvDX1EWo3-cjKbZI";
const INTERAC_SHEET_ID = "1qd8ivmSZ_FlepT5woZTTwzSvB_0PTfb0gh4ozWOQu10";

// Dynamically generate current tab name (e.g., "SEPTEMBER 2026")
function getCurrentTabName() {
  const now = new Date();
  const monthNames = [
    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
  ];
  return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
}

// Fetch CSV Data directly using Sheet ID & Tab Name
async function fetchSheetData(sheetId, tabName) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  try {
    const response = await fetch(url);
    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error("Error fetching sheet:", error);
    return [];
  }
}

// Basic CSV parser to convert rows into arrays
function parseCSV(text) {
  const lines = text.split("\n");
  return lines.map(line => {
    // Handles CSV quoting & comma splitting
    return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(cell => cell.replace(/^"|"$/g, '').trim());
  });
}

// Filter and display available LF lessons
async function loadAvailableLessons() {
  const currentTab = getCurrentTabName();
  console.log(`Fetching lessons for tab: ${currentTab}`);

  const kecData = await fetchSheetData(KEC_SHEET_ID, currentTab);
  const interacData = await fetchSheetData(INTERAC_SHEET_ID, currentTab);

  const availableLessons = [];

  // Parse KEC (Col B=Date, Col C=Time, Col D=School, Col G=Teacher, Col H=Status)
  kecData.forEach((row, rowIndex) => {
    const date = row[1];
    const lessonTime = row[2];
    const school = row[3];
    const teacher = row[6];
    const status = row[7]; // Column H

    if (status && status.toUpperCase().includes("LF")) {
      availableLessons.push({
        type: "KEC",
        rowIndex: rowIndex + 1, // 1-based index for sheet updates
        date,
        time: lessonTime,
        school,
        originalTeacher: teacher,
        status
      });
    }
  });

  // Parse Interac (Col B=Date, Col C=Access Time, Col D=Lesson Time, Col E=School, Col O=Teacher, Col P=Status)
  interacData.forEach((row, rowIndex) => {
    const date = row[1];
    const accessTime = row[2];
    const lessonTime = row[3];
    const school = row[4];
    const teacher = row[14];
    const status = row[15]; // Column P

    if (status && status.toUpperCase().includes("LF")) {
      availableLessons.push({
        type: "Interac",
        rowIndex: rowIndex + 1,
        date,
        time: `Access: ${accessTime} | Lesson: ${lessonTime}`,
        school,
        originalTeacher: teacher,
        status
      });
    }
  });

  renderCards(availableLessons);
}

function renderCards(lessons) {
  const container = document.getElementById("lessons-container");
  container.innerHTML = "";

  if (lessons.length === 0) {
    container.innerHTML = "<p>No lessons currently marked for substitution (LF).</p>";
    return;
  }

  lessons.forEach(lesson => {
    const card = document.createElement("div");
    card.className = "lesson-card";
    card.innerHTML = `
      <div class="tag ${lesson.type.toLowerCase()}">${lesson.type}</div>
      <h3>${lesson.school}</h3>
      <p><strong>Date:</strong> ${lesson.date}</p>
      <p><strong>Time:</strong> ${lesson.time}</p>
      <p><strong>Original Teacher:</strong> ${lesson.originalTeacher}</p>
      <button onclick="acceptLesson('${lesson.type}', ${lesson.rowIndex})">Accept Lesson</button>
    `;
    container.appendChild(card);
  });
}

// Initial load on startup
loadAvailableLessons();
