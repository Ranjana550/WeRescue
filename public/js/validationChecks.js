function togglePasswordVisibility() {
        $(".toggle-password").toggleClass("fa-eye fa-eye-slash");
        let input = $("#password");
        if (input.attr("type") == "password") {
            input.attr("type", "text");
        } else {
            input.attr("type", "password");
        }
}

function registerPageValidations() {
    passwordMatch();
}

function passwordMatch() {
    let password = document.getElementById('password').value;
    let confirmPassword = document.getElementById("confirm-password").value;

    if (password === confirmPassword) {
        return true;
    } else {
        alert("Password entered in the field 'Confim Password' does not match with the original");
        return false;
    }
}
