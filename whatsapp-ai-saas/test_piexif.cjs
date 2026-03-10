const piexif = require('piexifjs');
try {
    const exifObj = { '0th': {}, 'Exif': {}, 'GPS': {}, '1st': {}, 'Interop': {} };
    // Let's add some text with emojis and accents
    const text = "Beautiful dress 👗, très élégant!";

    // Simulating my escape function
    const escaped = unescape(encodeURIComponent(text));

    exifObj['0th'][piexif.ImageIFD.ImageDescription] = escaped;

    const bytes = piexif.dump(exifObj);
    console.log("Dump successful.");

    // Now simulate insert
    // Need a dummy base64 jpeg
    const dummyBase64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/";

    const newBase64 = piexif.insert(bytes, dummyBase64);
    console.log("Insert successful.");
} catch (e) {
    console.error("Error:", e.message);
}
