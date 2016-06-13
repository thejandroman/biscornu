var channels = new Bloodhound({
  datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
  queryTokenizer: Bloodhound.tokenizers.whitespace,
  remote: {
    url: '/channels/%QUERY',
    wildcard: '%QUERY'
  }
});

$('.typeahead').typeahead(
  { hint: true,
    highlight: true,
    minLength: 1 },
  { name: 'channels',
    source: channels }
);

$('#channel').keypress(function (e) {
  if (e.which == 13) {
    window.location.href = '/channel/' + $('#channel').val();
    return false;
  }
});

if ( $( '#all-pins' ).length ) {
  $.get('/pins', (data) => {
    $('#all-pins').html(data);
  })
  .fail(() => {
    $('#all-pins').html('Serious error');
  });
}

if ( $( '#top-voted' ).length ) {
  $.get('/top-pins', (data) => {
    $('#top-voted').html(data);
  })
    .fail(() => {
      $('#top-voted').html('Serious error');
    });
}

if ( $( '#random-pin' ).length ) {
  $.get('/random-pin', (data) => {
    $('#random-pin').html(data);
  })
  .fail(() => {
    $('#random-pin').html('Serious error');
  });
}

if ( $( '#pins' ).length ) {
  var channel = $('#pins').attr('channel');
  $.get('/pins/' + channel, (data) => {
    $('#pins').html(data);
  })
  .fail(() => {
    $('#pins').html('Serious error');
  });
}
