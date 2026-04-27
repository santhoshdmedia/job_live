export const formValidation = (message) => {
  return {
    required: true,
    message: message,
  };
};

export const EmailValidation = (message) => ({
  type: "email",
  required: true,
  message,
});

export const PasswordValidation = () => {
  return formValidation("Enter a valid password");
};

export const NameValidation = () => {
  return formValidation(`Enter a valid  name`);
};
