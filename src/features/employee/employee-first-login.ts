export const shouldRequireEmployeePasswordChange = (
  flags: Array<boolean | undefined>,
  passwordChangeCompleted: boolean,
) => {
  const explicitFlags = flags.filter((value): value is boolean => value !== undefined);

  if (explicitFlags.some((flag) => flag)) return true;
  if (explicitFlags.some((flag) => flag === false)) return false;
  return !passwordChangeCompleted;
};
