function showPopup(title, text, time)
{

    $.gritter.add({
        title: title,
        text: text || " ",
        time: time || 2000
    });
}

