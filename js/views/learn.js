/**
 * MatrixLab — Learn mode.
 *
 * Eight levels, beginner to advanced, each topic ending with something to try in
 * the tools. Lesson content lives in js/data/lessons.js as data; this file turns
 * it into pages and handles navigation.
 */
(function (ML) {
  'use strict';

  const ui = ML.ui;
  const el = ui.el;

  function buildView(context) {
    const topicId = context && context.path && context.path[0];
    if (topicId) {
      const found = ML.lessons.findTopic(topicId);
      if (found) return buildTopic(found);
    }
    return buildIndex();
  }

  /* ------------------------------------------------------------------ *
   * Index of levels
   * ------------------------------------------------------------------ */

  function buildIndex() {
    const visited = ML.store.getSetting('learn.visited', {});

    const intro = ui.card({
      className: 'card--accent',
      body: el('div.stack', [
        el('p', [
          'Linear algebra is unusually order-dependent: elimination underpins everything about systems, vector spaces ' +
            'give the language for rank, and eigenvalues only make sense once transformations do. These ' +
            ML.lessons.levels.length + ' levels follow that dependency order, and every topic ends with something ' +
            'concrete to try in the tools.',
        ]),
        el('div.row.row--tight', [
          ui.badge(ML.lessons.topicCount + ' topics', 'brand'),
          ui.badge(Object.keys(visited).length + ' visited'),
          ui.button('Start at the beginning', {
            variant: 'primary',
            size: 'sm',
            onClick: function () {
              ML.router.navigate('learn', [ML.lessons.levels[0].topics[0].id]);
            },
          }),
        ]),
      ]),
    });

    const levels = el(
      'div.levels',
      ML.lessons.levels.map(function (level) {
        return el('section.level', [
          el('div.level__head', [
            el('span.level__num', String(level.number)),
            el('div', [
              el('div.level__title', level.title),
              el('div.level__sub', level.summary),
            ]),
          ]),
          el(
            'ul.topic-list',
            level.topics.map(function (topic) {
              return el('li', [
                el('button.topic', {
                  type: 'button',
                  onClick: function () { ML.router.navigate('learn', [topic.id]); },
                }, [
                  el('span.topic__dot', { 'aria-hidden': 'true' }),
                  el('span', [
                    el('span.strong', topic.title),
                    el('span.tiny.muted', { style: { display: 'block' } }, topic.blurb),
                  ]),
                  visited[topic.id] ? ui.badge('read', 'ok') : null,
                ]),
              ]);
            })
          ),
        ]);
      })
    );

    return [intro, levels];
  }

  /* ------------------------------------------------------------------ *
   * A single topic
   * ------------------------------------------------------------------ */

  function buildTopic(found) {
    const topic = found.topic;
    const level = found.level;

    // Remember what has been read, purely so the index can show progress.
    const visited = ML.store.getSetting('learn.visited', {});
    visited[topic.id] = true;
    ML.store.setSetting('learn.visited', visited);

    const flat = ML.lessons.flat();
    const position = flat.findIndex(function (entry) { return entry.topic.id === topic.id; });
    const previous = position > 0 ? flat[position - 1] : null;
    const next = position >= 0 && position < flat.length - 1 ? flat[position + 1] : null;

    const navigation = el('div.row.row--between', [
      el('div.row.row--tight', [
        ui.button('← All levels', { variant: 'ghost', size: 'sm', onClick: function () { ML.router.navigate('learn'); } }),
      ]),
      el('div.row.row--tight', [
        previous
          ? ui.button('← ' + previous.topic.title, {
              size: 'sm',
              onClick: function () { ML.router.navigate('learn', [previous.topic.id]); },
            })
          : null,
        next
          ? ui.button(next.topic.title + ' →', {
              size: 'sm',
              variant: 'primary',
              onClick: function () { ML.router.navigate('learn', [next.topic.id]); },
            })
          : null,
      ]),
    ]);

    const body = el('div.lesson', topic.content.map(renderBlock).filter(Boolean));

    return [
      el('div.row.row--tight', [
        ui.badge('Level ' + level.number + ' — ' + level.title, 'brand'),
        el('span.small.muted', 'topic ' + (position + 1) + ' of ' + flat.length),
      ]),
      ui.card({
        title: topic.title,
        subtitle: topic.blurb,
        body: body,
        foot: navigation,
      }),
    ];
  }

  /**
   * Render one content block. Blocks are plain data so the lesson file stays
   * readable and free of markup.
   */
  function renderBlock(block) {
    if (block.h) return el('h3', block.h);
    if (block.p) return el('p', inline(block.p));
    if (block.formula) return el('div.formula.formula--block', block.formula);
    if (block.list) {
      return el('ul', block.list.map(function (item) { return el('li', inline(item)); }));
    }
    if (block.note) {
      return el('div.callout', [el('div.callout__title', 'Note'), el('p', inline(block.note))]);
    }
    if (block.callout) {
      return el('div.callout', [
        el('div.callout__title', block.callout.title),
        el('p', inline(block.callout.text)),
      ]);
    }
    if (block.matrix) {
      let matrix = null;
      try {
        matrix = ML.Matrix.from(block.matrix);
      } catch (error) {
        return el('p.small', { style: { color: 'var(--err-fg)' } }, 'Example matrix could not be built.');
      }
      return el('div', { style: { margin: '14px 0' } }, [
        ui.renderMatrix(matrix, { label: block.label }),
      ]);
    }
    if (block.try) {
      const target = ML.getView(block.try.view);
      return el('div.callout.callout--try', [
        el('div.callout__title', 'Try it'),
        el('p', inline(block.try.text)),
        target
          ? ui.button('Open ' + target.title, {
              size: 'sm',
              onClick: function () { ML.router.navigate(block.try.view); },
            })
          : null,
      ]);
    }
    return null;
  }

  /**
   * Minimal inline markup: **bold** only. Kept deliberately small — the lesson
   * text should read as prose, not as a markup exercise.
   */
  function inline(text) {
    const parts = String(text).split(/\*\*(.+?)\*\*/g);
    return parts.map(function (part, index) {
      return index % 2 === 1 ? el('strong', part) : part;
    });
  }

  ML.registerView({
    id: 'learn',
    title: 'Learn',
    heading: 'Learn Linear Algebra',
    tagline: 'Eight levels from "what is a matrix" to the singular value decomposition, in the order the ideas depend on each other.',
    icon: '✦',
    build: buildView,
  });
})((globalThis.ML = globalThis.ML || {}));
