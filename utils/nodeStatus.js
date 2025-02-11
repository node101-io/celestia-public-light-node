let nodeRestarting = false;

export const isNodeRestarting = async () => {
  if (nodeRestarting)
    await new Promise(resolve => setTimeout(resolve, 5000));

  return nodeRestarting;
};
export const setNodeRestarting = is_restarting => nodeRestarting = is_restarting;
