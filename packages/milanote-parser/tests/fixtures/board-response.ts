export const ROOT_BOARD_ID = "board_demo_alpha";

const paragraph = (text: string) => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text }],
    },
  ],
});

export const fakeBoardResponse: unknown = {
  elements: {
    [ROOT_BOARD_ID]: {
      id: ROOT_BOARD_ID,
      elementType: "BOARD",
      location: { rootBoard: true },
      content: {
        title: "Demo workspace",
        color: "navy",
        defaultColorPalette: ["navy", "sand"],
        icon: {
          type: "mn-svg",
          id: "icon_demo",
          name: "Compass",
          svg: "https://cdn.example.test/compass.svg",
        },
      },
      meta: {
        createdTime: 1_700_000_000_000,
        modifiedTime: 1_700_000_001_000,
      },
    },
    column_demo: {
      id: "column_demo",
      elementType: "COLUMN",
      location: {
        parentId: ROOT_BOARD_ID,
        section: "CANVAS",
        position: { x: 500, y: 100, score: 2 },
      },
      content: { title: "Ideas" },
    },
    card_demo: {
      id: "card_demo",
      elementType: "CARD",
      location: {
        parentId: "column_demo",
        section: "COLUMN",
        position: { index: 0, score: 1 },
      },
      content: {
        textContent: {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 2 },
              content: [{ type: "text", text: "A clear card" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "With context" }],
            },
          ],
        },
        background: "mint",
        transparent: { enabled: false },
      },
    },
    image_demo: {
      id: "image_demo",
      elementType: "IMAGE",
      location: {
        parentId: ROOT_BOARD_ID,
        section: "CANVAS",
        position: { x: 0, y: 0, score: 1 },
      },
      content: {
        image: {
          regular: "https://cdn.example.test/photo.webp",
          original: "https://cdn.example.test/photo-original.webp",
          thumb: "https://cdn.example.test/photo-thumb.webp",
          width: 1200,
          height: 800,
          primaryColor: "#334455",
          colors: ["#334455", "#ddeeff"],
          transparent: false,
        },
        file: {
          type: "IMAGE",
          ext: "webp",
          mime: "image/webp",
          filename: "photo.webp",
          size: 2048,
        },
      },
    },
    file_demo: {
      id: "file_demo",
      elementType: "FILE",
      location: {
        parentId: ROOT_BOARD_ID,
        section: "CANVAS",
        position: { x: 250, y: 0, score: 3 },
      },
      content: {
        title: "Project brief",
        previewReady: true,
        displayMode: "ICON_VIEW",
        file: {
          type: "TEXT",
          ext: "pdf",
          mime: "application/pdf",
          filename: "brief.pdf",
          size: 4096,
          url: "https://cdn.example.test/brief.pdf",
          uploadedTimestamp: 1_700_000_002_000,
        },
      },
    },
    link_demo: {
      id: "link_demo",
      elementType: "LINK",
      location: {
        parentId: ROOT_BOARD_ID,
        section: "CANVAS",
        position: { x: 500, y: 0, score: 4 },
      },
      content: {
        mediaType: "website",
        link: {
          url: "https://example.test/article",
          title: "Example article",
          favicon: "https://example.test/favicon.ico",
        },
        provider: {
          name: "Example",
          url: "https://example.test",
          display: "example.test",
        },
        caption: paragraph("Useful reference"),
        showCaption: true,
      },
    },
    tasks_demo: {
      id: "tasks_demo",
      elementType: "TASK_LIST",
      location: {
        parentId: ROOT_BOARD_ID,
        section: "CANVAS",
        position: { x: 0, y: 300, score: 5 },
      },
      content: { title: "Next steps", showTitle: true },
    },
    task_later: {
      id: "task_later",
      elementType: "TASK",
      location: {
        parentId: "tasks_demo",
        section: "LIST",
        position: { index: 1, score: 20 },
      },
      content: {
        textContent: paragraph("Ship later"),
        checked: false,
      },
    },
    task_first: {
      id: "task_first",
      elementType: "TASK",
      location: {
        parentId: "tasks_demo",
        section: "LIST",
        position: { index: 0, score: 10 },
      },
      content: {
        textContent: paragraph("Ship first"),
        completed: true,
        dueDate: "2030-04-05",
        hasDueDateTime: false,
        dueReminder: "0",
        dueReminderTimestamp: 1_901_234_567_000,
      },
    },
    table_demo: {
      id: "table_demo",
      elementType: "TABLE",
      location: {
        parentId: ROOT_BOARD_ID,
        section: "CANVAS",
        position: { x: 300, y: 300, score: 6 },
      },
      content: {
        width: 720,
        tableContent: {
          data: [
            [
              {
                value: "Feature",
                textStyle: ["BOLD"],
                background: "gray",
                draftContent: {
                  blocks: [
                    {
                      key: "cell_a",
                      text: "Feature",
                      type: "unstyled",
                      depth: 0,
                      inlineStyleRanges: [],
                      entityRanges: [],
                      data: {},
                    },
                  ],
                  entityMap: {},
                },
              },
              { value: "Status", textStyle: [] },
            ],
          ],
          colWidthsGU: [240, 180],
          version: "1",
        },
      },
    },
    thread_demo: {
      id: "thread_demo",
      elementType: "COMMENT_THREAD",
      location: {
        parentId: ROOT_BOARD_ID,
        section: "CANVAS",
        position: { x: 600, y: 300, score: 7 },
      },
      content: { threadId: "thread_fictional" },
    },
    nested_board_demo: {
      id: "nested_board_demo",
      elementType: "BOARD",
      location: {
        parentId: ROOT_BOARD_ID,
        section: "CANVAS",
        position: { x: 900, y: 300, score: 8 },
      },
      content: {
        title: "Nested demo",
        defaultColorPalette: [],
      },
    },
    mystery_demo: {
      id: "mystery_demo",
      elementType: "AUDIO_NOTE",
      location: {
        parentId: ROOT_BOARD_ID,
        section: "CANVAS",
        position: { x: 900, y: 600, score: 9 },
      },
      content: {
        waveform: [0.1, 0.4, 0.2],
        extra: undefined,
      },
    },
    skeleton_demo: {
      id: "skeleton_demo",
      elementType: "SKELETON",
      location: {
        parentId: ROOT_BOARD_ID,
        section: "CANVAS",
        position: { x: 1100, y: 600, score: 10 },
        rootBoard: false,
      },
    },
  },
  comments: {
    comment_later: {
      id: "comment_later",
      threadId: "thread_fictional",
      userId: "person_demo_b",
      text: paragraph("Second comment"),
      createdAt: 1_700_000_004_000,
      updatedAt: 1_700_000_004_500,
    },
    comment_first: {
      id: "comment_first",
      threadId: "thread_fictional",
      userId: "person_demo_a",
      text: paragraph("First comment"),
      createdAt: 1_700_000_003_000,
      updatedAt: 1_700_000_003_500,
    },
  },
  errors: {},
  childrenReturned: {
    [ROOT_BOARD_ID]: true,
  },
  canvasOrder: {
    [ROOT_BOARD_ID]: [
      "image_demo",
      "column_demo",
      "file_demo",
      "link_demo",
      "tasks_demo",
      "table_demo",
      "thread_demo",
      "nested_board_demo",
      "mystery_demo",
      "skeleton_demo",
    ],
  },
  boardIds: [ROOT_BOARD_ID],
  fetchedTime: 1_700_000_005_000,
};
