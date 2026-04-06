function createFallbackDemoItem(index) {
  return {
    src: demoImagePool[index % demoImagePool.length],
    isLive: false,
    opacity: clamp(0.03 + randomBetween(-0.006, 0.01), 0.015, 0.05)
  };
}

function buildGridItems(liveImages) {
  const items = [];

  if (liveImages.length === 0) {
    for (let i = 0; i < GRID_CELL_COUNT; i += 1) {
      items.push(createFallbackDemoItem(i));
    }
    return items;
  }

  for (let i = 0; i < GRID_CELL_COUNT; i += 1) {
    const source = liveImages[i % liveImages.length];
    const sourceAgeIndex = i % liveImages.length;
    const ageFade = getAgeFade(sourceAgeIndex, liveImages.length);

    items.push({
      src: source.imageUrl,
      isLive: true,
      opacity: clamp((0.18 + randomBetween(-0.03, 0.03)) * ageFade, 0.05, 0.18),
      region: source.region || null
    });
  }

  return items;
}
